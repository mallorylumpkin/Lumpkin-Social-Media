import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

// Makes an original text graphic (PNG) for one slide/frame of a content package.
// No stock photos and no AI-drawn products: these are your own text cards, so there are no image-rights questions.
// Add your own product photo or screen recording behind or beside them in your phone's editor.
export const dynamic = "force-dynamic";

const THEMES: [string, string][] = [
  ["#c2410c", "#7c2d12"],
  ["#be185d", "#831843"],
  ["#0f766e", "#134e4a"],
  ["#6d28d9", "#4c1d95"]
];

const clean = (t: string) => t.replace(/\p{Extended_Pictographic}|️|‍/gu, "").replace(/\s+/g, " ").trim();

function fontFor(text: string, scale: number) {
  const n = text.length;
  const px = n <= 28 ? 124 : n <= 56 ? 100 : n <= 96 ? 82 : 66;
  return Math.round(px * scale);
}

export async function GET(req: Request) {
  try {
    return await render(req);
  } catch (e: any) {
    return new Response(`Image error: ${e?.message ?? String(e)}`, { status: 500, headers: { "content-type": "text/plain" } });
  }
}

async function render(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("v") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad request", { status: 400 });
  const i = Math.max(0, Math.min(11, parseInt(url.searchParams.get("i") ?? "0", 10) || 0));

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const { data: v } = await supabase
    .from("content_versions")
    .select("platform, content_type, hook, on_screen_text")
    .eq("id", id)
    .maybeSingle();
  if (!v) return new Response("Not found", { status: 404 });

  const texts: string[] = (Array.isArray(v.on_screen_text) ? v.on_screen_text : []).map((t: unknown) => clean(String(t))).filter(Boolean);
  const hook = clean(v.hook ?? "");
  const isPin = v.platform === "pinterest";
  const main = isPin ? hook || texts[0] || "" : texts[i] ?? texts[0] ?? hook;
  const sub = isPin && texts[0] && texts[0] !== main ? texts[0] : "";
  const total = isPin ? 1 : Math.max(1, Math.min(8, texts.length));

  const width = isPin ? 1000 : 1080;
  const height = isPin ? 1500 : v.content_type === "carousel" ? 1350 : 1920;
  const scale = height === 1350 ? 0.85 : 1;
  const [c1, c2] = THEMES[i % THEMES.length];

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 80, color: "#ffffff", backgroundImage: `linear-gradient(160deg, ${c1}, ${c2})`
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, opacity: 0.9 }}>
          <span>Mallory Lumpkin</span>
          {total > 1 && <span>{`${i + 1} / ${total}`}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: fontFor(main, scale), fontWeight: 800, lineHeight: 1.12 }}>{main}</div>
          {sub && <div style={{ display: "flex", fontSize: 48, marginTop: 36, opacity: 0.92 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.8 }}>Link in bio</div>
      </div>
    ),
    {
      width,
      height,
      headers: url.searchParams.get("dl")
        ? { "content-disposition": `attachment; filename="post-${v.platform}-${i + 1}.png"`, "cache-control": "private, no-store" }
        : { "cache-control": "private, no-store" }
    }
  );
  return image;
}
