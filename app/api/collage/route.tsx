import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { collageLayout } from "@/lib/collage";

// Renders a collage board (PNG) from the product images you uploaded. Nothing is fetched from retailer sites.
export const dynamic = "force-dynamic";

const keep = (t: string) =>
  t.replace(/[^ -~ -ÿ–—‘’“”…™•]/g, "").replace(/\s+/g, " ").trim();

async function font(name: string) {
  const res = await fetch(new URL(`./fonts/${name}.ttf`, import.meta.url));
  return res.arrayBuffer();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("v") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad request", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const { data: v } = await supabase.from("content_versions").select("id, idea_id, platform, content_type, on_screen_text").eq("id", id).maybeSingle();
  if (!v) return new Response("Not found", { status: 404 });

  const [{ data: prodRows }, { data: assetRows }] = await Promise.all([
    supabase.from("content_idea_products").select("position, products(canonical_title)").eq("idea_id", v.idea_id).order("position"),
    supabase.from("content_version_assets").select("position, content_assets(storage_ref)").eq("version_id", id).order("position")
  ]);
  const titles: string[] = (prodRows ?? []).map((r: any) => keep(r.products?.canonical_title ?? ""));
  const n = Math.max(2, Math.min(6, titles.length));
  const texts: string[] = (Array.isArray(v.on_screen_text) ? v.on_screen_text : []).map((t: unknown) => keep(String(t ?? "")));
  const kicker = (texts[0] || "This Week's Favorites").toUpperCase();
  const subtitle = texts[1] || "";
  const labels = texts.slice(2);

  const images: (string | null)[] = Array(n).fill(null);
  for (const r of assetRows ?? []) {
    const ref = (r as any).content_assets?.storage_ref as string | undefined;
    const pos = (r as any).position as number;
    if (!ref || pos < 0 || pos >= n) continue;
    const { data: blob } = await supabase.storage.from("product-images").download(ref);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    images[pos] = `data:${blob.type || "image/jpeg"};base64,${buf.toString("base64")}`;
  }

  const isPin = v.platform === "pinterest";
  const width = isPin ? 1000 : 1080;
  const height = isPin ? 1500 : 1350;
  const rects = collageLayout(n, width, height);
  const [regular, bold, italic] = await Promise.all([font("serif"), font("serif-bold"), font("serif-italic")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#f4efe7", fontFamily: "Serif", color: "#3b342b" }}>
        <div style={{ position: "absolute", left: 44, top: 44, right: 44, bottom: 44, display: "flex", border: "2px solid #cdc3b2" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: "#6f6554" }}>{kicker}</div>
          {subtitle && <div style={{ display: "flex", fontSize: 78, fontWeight: 700, marginTop: 18, color: "#3b342b" }}>{subtitle}</div>}
        </div>
        {rects.map((r, i) => (
          <div
            key={i}
            style={{
              position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#ffffff", borderRadius: 14, padding: 16, boxShadow: "0 12px 30px rgba(60,50,30,0.16)", transform: `rotate(${r.rot}deg)`
            }}
          >
            {images[i] ? (
              <img src={images[i] as string} width={r.w - 32} height={r.h - 32} style={{ objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", padding: 24, fontSize: 30, color: "#8a7f6e", textAlign: "center" }}>{titles[i] || "Add a photo"}</div>
            )}
            {labels[i] ? (
              <div
                style={{
                  position: "absolute", left: -20, bottom: 28, display: "flex", backgroundColor: "#f6d9df", border: "2px solid #e7b4c0",
                  padding: "8px 24px", fontSize: 30, fontStyle: "italic", color: "#7a3b4a", transform: "rotate(-3deg)"
                }}
              >
                {labels[i]}
              </div>
            ) : null}
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 84, display: "flex", justifyContent: "center", fontSize: 46, fontStyle: "italic", color: "#8a7f6e" }}>Mallory Lumpkin</div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Serif", data: regular, weight: 400, style: "normal" },
        { name: "Serif", data: bold, weight: 700, style: "normal" },
        { name: "Serif", data: italic, weight: 400, style: "italic" }
      ],
      headers: url.searchParams.get("dl")
        ? { "content-disposition": `attachment; filename="collage-${v.platform}.png"`, "cache-control": "private, no-store" }
        : { "cache-control": "private, no-store" }
    }
  );
}
