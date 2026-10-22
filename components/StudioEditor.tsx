"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shrink, shrinkAndCut } from "@/lib/image-tools";
import { createClient } from "@/lib/supabase/client";
import { importCollage } from "@/app/(app)/collages/actions";
import { SCENES, drawScene, makeSticker, type SceneKey } from "@/lib/scenes";
import { FORMATS, autoArrange, hitItem, type FormatKey, type Zone } from "@/lib/studio-layout";
import { collageFooter } from "@/lib/handles";

type Item = {
  id: string; name: string; img: ImageBitmap; sticker: HTMLCanvasElement; w: number; h: number;
  x: number; y: number; scale: number; rot: number; outline: boolean; shadow: boolean; cut: boolean;
};
type P = { id: string; title: string };
const FONTS = [
  { key: "serif", label: "Classic", css: "Georgia, 'Times New Roman', serif", weight: "700" },
  { key: "sans", label: "Bold", css: "'Helvetica Neue', Arial, sans-serif", weight: "800" },
  { key: "script", label: "Script", css: "'Brush Script MT', 'Segoe Script', cursive", weight: "400" }
];

export function StudioEditor({ orgId, products, handles }: { orgId: string; products: P[]; handles: { instagram: string | null; tiktok: string | null } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ key: string; canvas: HTMLCanvasElement; zone: Zone } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: "none" | "drag" | "pinch"; dx: number; dy: number; d0: number; a0: number; s0: number; r0: number }>({ kind: "none", dx: 0, dy: 0, d0: 1, a0: 0, s0: 1, r0: 0 });

  const [fmt, setFmt] = useState<FormatKey>("instagram");
  const [scene, setScene] = useState<SceneKey>("cart");
  const [color, setColor] = useState("#f9c5d1");
  const [photoBg, setPhotoBg] = useState<ImageBitmap | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState("Top Finds");
  const [font, setFont] = useState("serif");
  const [textColor, setTextColor] = useState("#2a2623");
  const [removeBg, setRemoveBg] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sceneTick, setSceneTick] = useState(0);
  const [showSend, setShowSend] = useState(false);

  const W = FORMATS[fmt].w;
  const H = FORMATS[fmt].h;
  const selected = items.find((i) => i.id === sel) ?? null;

  const ensureScene = useCallback((): { canvas: HTMLCanvasElement; zone: Zone } => {
    const key = `${scene}|${color}|${W}x${H}|${photoBg ? "p" : "n"}${sceneTick}`;
    if (sceneRef.current?.key === key) return sceneRef.current;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const zone = drawScene(c.getContext("2d")!, scene, W, H, color, photoBg ?? undefined);
    sceneRef.current = { key, canvas: c, zone };
    return sceneRef.current;
  }, [scene, color, W, H, photoBg, sceneTick]);

  const draw = useCallback((forExport: boolean) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(ensureScene().canvas, 0, 0);
    for (const it of items) {
      ctx.save();
      ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(it.scale, it.scale);
      if (it.shadow) { ctx.shadowColor = "rgba(0,0,0,0.32)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14; }
      const src = it.outline && it.cut ? it.sticker : it.img;
      ctx.drawImage(src, -src.width / 2, -src.height / 2);
      ctx.restore();
    }
    const f = FONTS.find((x) => x.key === font) ?? FONTS[0];
    ctx.save();
    ctx.fillStyle = textColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (title.trim()) {
      let size = Math.round(W * 0.1);
      ctx.font = `${f.weight} ${size}px ${f.css}`;
      const mw = ctx.measureText(title).width;
      if (mw > W * 0.88) { size = Math.floor((size * W * 0.88) / mw); ctx.font = `${f.weight} ${size}px ${f.css}`; }
      ctx.fillText(title.trim(), W / 2, H * 0.085);
    }
    ctx.font = `italic 500 ${Math.round(W * 0.04)}px Georgia, serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(collageFooter(fmt, fmt === "instagram" ? handles.instagram : fmt === "tiktok" ? handles.tiktok : null), W / 2, H - W * 0.06);
    ctx.restore();
    if (!forExport && selected) {
      ctx.save();
      ctx.translate(selected.x, selected.y); ctx.rotate(selected.rot);
      const hw = (selected.w * selected.scale) / 2, hh = (selected.h * selected.scale) / 2;
      ctx.setLineDash([14, 10]); ctx.lineWidth = 5; ctx.strokeStyle = "#c2410c";
      ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
      ctx.restore();
    }
  }, [items, selected, title, font, textColor, fmt, W, H, handles, ensureScene]);

  useEffect(() => { draw(false); }, [draw]);

  // Moving to a different shape keeps everything in the same relative place.
  const prevDims = useRef({ w: W, h: H });
  useEffect(() => {
    const p = prevDims.current;
    if (p.w !== W || p.h !== H) {
      setItems((cur) => cur.map((i) => ({ ...i, x: (i.x * W) / p.w, y: (i.y * H) / p.h, scale: (i.scale * W) / p.w })));
      prevDims.current = { w: W, h: H };
    }
  }, [W, H]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("Preparing your pictures…"); setMsg(null);
    try {
      const made: Item[] = [];
      let kept = 0;
      for (const f of Array.from(files).slice(0, 12)) {
        if (!f.type.startsWith("image/")) continue;
        let blob: Blob; let cut = false;
        if (removeBg) { const r = await shrinkAndCut(f); blob = r.blob; cut = r.removed; if (!r.removed) kept++; }
        else blob = await shrink(f, 1400);
        const img = await createImageBitmap(blob);
        made.push({ id: crypto.randomUUID(), name: f.name, img, sticker: makeSticker(img), w: img.width, h: img.height, x: W / 2, y: H / 2, scale: 1, rot: 0, outline: true, shadow: true, cut });
      }
      if (!made.length) { setMsg("Choose picture files."); return; }
      const zone = ensureScene().zone;
      const placed = autoArrange(made.map((m) => ({ w: m.w, h: m.h })), zone, Date.now() % 1000);
      made.forEach((m, i) => Object.assign(m, placed[i]));
      setItems((cur) => [...cur, ...made]);
      setSel(made[made.length - 1].id);
      if (kept) setMsg(`${kept} picture${kept > 1 ? "s" : ""} kept the original background. Photos on a plain white or light wall work best for removal.`);
    } catch (e: any) { setMsg(e?.message ?? "Could not read that picture."); }
    finally { setBusy(null); }
  }

  async function setPhoto(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    try { const b = await shrink(f, 2000); setPhotoBg(await createImageBitmap(b)); setScene("photo"); }
    catch (e: any) { setMsg(e?.message ?? "Could not read that photo."); }
  }

  const patch = (id: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  function rearrange() {
    const zone = ensureScene().zone;
    const placed = autoArrange(items.map((m) => ({ w: m.w, h: m.h })), zone, Date.now() % 1000);
    setItems((cur) => cur.map((m, i) => ({ ...m, ...placed[i] })));
  }
  function toFront(id: string) { setItems((cur) => { const it = cur.find((i) => i.id === id); return it ? [...cur.filter((i) => i.id !== id), it] : cur; }); }
  function duplicate(id: string) {
    const it = items.find((i) => i.id === id); if (!it) return;
    const copy = { ...it, id: crypto.randomUUID(), x: it.x + 50, y: it.y + 50 };
    setItems((cur) => [...cur, copy]); setSel(copy.id);
  }

  // ---- touch / mouse ----
  function toCanvas(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && selected) {
      const [a, b] = Array.from(pointers.current.values()) as { x: number; y: number }[];
      gesture.current = { kind: "pinch", dx: 0, dy: 0, d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), s0: selected.scale, r0: selected.rot };
      return;
    }
    const hit = [...items].reverse().find((i) => hitItem(p.x, p.y, i));
    if (hit) { setSel(hit.id); gesture.current = { ...gesture.current, kind: "drag", dx: hit.x - p.x, dy: hit.y - p.y }; }
    else { setSel(null); gesture.current.kind = "none"; }
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(e.pointerId) || !selected) return;
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values()) as { x: number; y: number }[];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      patch(selected.id, { scale: Math.min(3, Math.max(0.05, (g.s0 * d) / g.d0)), rot: g.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - g.a0) });
    } else if (g.kind === "drag") patch(selected.id, { x: p.x + g.dx, y: p.y + g.dy });
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2 && gesture.current.kind === "pinch") gesture.current.kind = "none";
    if (!pointers.current.size) gesture.current.kind = "none";
  }

  // ---- output ----
  async function exportBlob(): Promise<Blob> {
    draw(true);
    const cv = canvasRef.current!;
    const p = new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Could not create the picture."))), "image/png"));
    draw(false);
    return p;
  }
  async function download() {
    setBusy("Saving…");
    try {
      const blob = await exportBlob();
      const file = new File([blob], `mallory-${fmt}.png`, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file] }); return; } catch (e: any) { if (e?.name === "AbortError") return; } }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { setMsg(e?.message ?? "Could not save."); }
    finally { setBusy(null); }
  }
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!items.length) { setMsg("Add at least one picture first."); return; }
    setBusy("Sending to approval…"); setMsg(null);
    try {
      const blob = await exportBlob();
      const path = `${orgId}/imports/${crypto.randomUUID()}.png`;
      const { error } = await createClient().storage.from("product-images").upload(path, blob, { contentType: "image/png", upsert: false });
      if (error) throw new Error(error.message);
      fd.set("path", path); fd.set("platform", fmt); fd.set("title", title.slice(0, 40) || "Top Finds");
      const res = await importCollage(fd);
      if (res && "error" in res) setMsg(res.error);
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("NEXT_REDIRECT")) setMsg(err?.message ?? "Could not send.");
    } finally { setBusy(null); }
  }

  const sc = SCENES.find((s) => s.key === scene)!;
  return (
    <div className="studio">
      <div className="studio-canvas card">
        <canvas ref={canvasRef} width={W} height={H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Your design. Drag pictures to move them; pinch to resize and turn." />
        <p className="muted small" style={{ textAlign: "center" }}>Drag to move. Pinch with two fingers to resize and turn.</p>
      </div>

      <div className="card">
        <h2>1. Add your product pictures</h2>
        <label className="check"><input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} /> Remove the background (works best on plain backgrounds)</label>
        <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} aria-label="Choose product pictures or screenshots" />
        {busy && <p className="muted">{busy}</p>}
        {msg && <div className="flash err" style={{ marginTop: 8 }}>{msg}</div>}
      </div>

      <div className="card">
        <h2>2. Pick a background</h2>
        <div className="chips">
          {SCENES.map((s) => (
            <button type="button" key={s.key} className={scene === s.key ? "chip on" : "chip"} onClick={() => { setScene(s.key); if ("defaultColor" in s && s.defaultColor) setColor(s.defaultColor); }}>{s.label}</button>
          ))}
        </div>
        {sc.colorable && (<><label htmlFor="sc">Color</label><input id="sc" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></>)}
        {scene === "photo" && (<><label htmlFor="bgp">Your background photo (a cart, a table, a bed, a counter, shot from above)</label><input id="bgp" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files)} /></>)}
        <label htmlFor="fmt">Made for</label>
        <select id="fmt" value={fmt} onChange={(e) => setFmt(e.target.value as FormatKey)}>
          {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card">
        <h2>3. Adjust</h2>
        {items.length === 0 && <p className="muted small">Add pictures above, then tap one to adjust it.</p>}
        <div className="chips">
          {items.map((i, n) => (<button type="button" key={i.id} className={sel === i.id ? "chip on" : "chip"} onClick={() => setSel(i.id)}>Picture {n + 1}</button>))}
        </div>
        {selected && (
          <>
            <label htmlFor="sz">Size</label>
            <input id="sz" type="range" min={0.05} max={3} step={0.01} value={selected.scale} onChange={(e) => patch(selected.id, { scale: Number(e.target.value) })} />
            <label htmlFor="rt">Turn</label>
            <input id="rt" type="range" min={-3.14} max={3.14} step={0.01} value={selected.rot} onChange={(e) => patch(selected.id, { rot: Number(e.target.value) })} />
            <label className="check"><input type="checkbox" checked={selected.shadow} onChange={(e) => patch(selected.id, { shadow: e.target.checked })} /> Soft shadow</label>
            {selected.cut && <label className="check"><input type="checkbox" checked={selected.outline} onChange={(e) => patch(selected.id, { outline: e.target.checked })} /> White sticker edge</label>}
            <div className="actions">
              <button type="button" onClick={() => toFront(selected.id)}>Bring to front</button>
              <button type="button" onClick={() => duplicate(selected.id)}>Duplicate</button>
              <button type="button" onClick={() => { setItems((c) => c.filter((i) => i.id !== selected.id)); setSel(null); }}>Remove</button>
            </div>
          </>
        )}
        {items.length > 1 && <div className="actions"><button type="button" onClick={rearrange}>Auto-arrange all</button></div>}
        <label htmlFor="tt">Title on the picture</label>
        <input id="tt" type="text" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="chips">{FONTS.map((f) => (<button type="button" key={f.key} className={font === f.key ? "chip on" : "chip"} style={{ fontFamily: f.css }} onClick={() => setFont(f.key)}>{f.label}</button>))}</div>
        <label htmlFor="tc">Text color</label>
        <input id="tc" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
        <p className="muted small">Your username is added at the bottom automatically. No disclosure text goes on the picture; it goes on the last line of the caption.</p>
      </div>

      <div className="card">
        <h2>4. Save or post</h2>
        <div className="actions">
          <button type="button" className="primary" onClick={download} disabled={!!busy || !items.length}>Save / share picture</button>
          <button type="button" onClick={() => setShowSend((v) => !v)} disabled={!items.length}>Send to approval</button>
        </div>
        {showSend && (
          <form onSubmit={send}>
            <p className="muted small">This creates the caption, runs the rules check and puts it in your Approval Queue for {FORMATS[fmt].label}.</p>
            <label>Products shown (1 to 6, for links and the rules check)</label>
            {products.length === 0 && <p className="muted small">Add and approve products first.</p>}
            {products.map((p) => (<label className="check" key={p.id}><input type="checkbox" name="product_id" value={p.id} /> {p.title}</label>))}
            <label htmlFor="sub">Short line for the caption</label>
            <input id="sub" name="subtitle" type="text" defaultValue="Shop the look" maxLength={40} />
            <label htmlFor="src">Where did the product pictures come from?</label>
            <select id="src" name="source" defaultValue="owner_provided">
              <option value="owner_provided">My own photos or screenshots</option>
              <option value="retailer_permitted">An affiliate program&apos;s own tool that allows sharing</option>
            </select>
            <label className="check"><input type="checkbox" name="rights" value="yes" /> I have the right to use and share these pictures</label>
            <div className="actions"><button className="primary" type="submit" disabled={!!busy}>{busy ?? "Send to approval"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
