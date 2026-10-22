"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadProductImages } from "@/lib/upload-product-images";

export function ImageUploader({ orgId, productId }: { orgId: string; productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [source, setSource] = useState("owner_provided");
  const [cut, setCut] = useState(true);
  const [over, setOver] = useState(false);

  async function handle(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    if (!rights) {
      setMsg("Tick the box confirming you have the right to use these images first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadProductImages({ orgId, productId, files: images, source, cut });
      setMsg(cut ? `Uploaded ${r.uploaded}. Background removed on ${r.cut}${r.cut < r.uploaded ? " (the rest had busy backgrounds, so they were kept as they are)" : ""}.` : `Uploaded ${r.uploaded}.`);
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={`src_${productId}`} style={{ marginTop: 0 }}>Where did the image come from?</label>
      <select id={`src_${productId}`} value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="owner_provided">My own photo or screenshot I made</option>
        <option value="retailer_permitted">From my affiliate program&apos;s own tools (allowed for my use)</option>
        <option value="official_product_media">Brand or press media I have permission to use</option>
      </select>
      <label className="check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> I have the right to use these images in my posts
      </label>
      <label className="check">
        <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} /> Remove a plain white or solid background (works best on clean product shots)
      </label>
      <div
        tabIndex={0}
        role="group"
        aria-label="Drop, paste or choose images"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(Array.from(e.dataTransfer.files)); }}
        onPaste={(e) => handle(Array.from(e.clipboardData.files))}
        style={{ marginTop: 8, padding: 14, border: `2px dashed ${over ? "var(--accent)" : "var(--line)"}`, borderRadius: 12, textAlign: "center" }}
      >
        <div className="small muted">Drag photos here, click here and paste a screenshot (Ctrl+V), or choose files</div>
        <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; handle(f); }} style={{ marginTop: 8 }} aria-label="Choose images" />
      </div>
      {busy && <p className="muted small">Uploading…</p>}
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
