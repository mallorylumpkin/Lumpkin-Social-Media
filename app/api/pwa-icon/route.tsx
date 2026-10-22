import { ImageResponse } from "next/og";

// Home-screen icon for the phone shortcut. Public on purpose: the phone fetches it before you sign in.
export async function GET(req: Request) {
  const s = Number(new URL(req.url).searchParams.get("s"));
  const size = s === 512 || s === 180 ? s : 192;
  try {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c2410c", color: "#ffffff", fontSize: size * 0.58, fontWeight: 700 }}>M</div>
      ),
      { width: size, height: size }
    );
  } catch (e: any) {
    return new Response(`Icon error: ${e?.message ?? e}`, { status: 500 });
  }
}
