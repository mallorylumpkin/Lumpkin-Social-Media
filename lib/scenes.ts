import { rng, type Zone } from "./studio-layout";

export const SCENES = [
  { key: "cart", label: "Shopping cart (top view)", colorable: false },
  { key: "gingham", label: "Picnic blanket", colorable: true, defaultColor: "#f4a6b8" },
  { key: "marble", label: "White marble", colorable: false },
  { key: "wood", label: "Wood table", colorable: true, defaultColor: "#c8a27a" },
  { key: "linen", label: "Soft linen", colorable: true, defaultColor: "#efe6d8" },
  { key: "tile", label: "Bathroom tile", colorable: false },
  { key: "gradient", label: "Color gradient", colorable: true, defaultColor: "#f9c5d1" },
  { key: "solid", label: "Solid color", colorable: true, defaultColor: "#ffffff" },
  { key: "photo", label: "My own photo", colorable: false }
] as const;
export type SceneKey = (typeof SCENES)[number]["key"];

type Ctx = CanvasRenderingContext2D;

function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const inset = (w: number, h: number): Zone => ({ x: w * 0.07, y: h * 0.17, w: w * 0.86, h: h * 0.7 });

/** Draws a background scene and returns the area where products should go. */
export function drawScene(ctx: Ctx, key: SceneKey, w: number, h: number, color: string, photo?: CanvasImageSource & { width: number; height: number }): Zone {
  const rand = rng(11);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  switch (key) {
    case "cart": return cart(ctx, w, h);
    case "gingham": {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      const s = 70;
      ctx.fillStyle = color; ctx.globalAlpha = 0.55;
      for (let y = 0; y < h; y += s * 2) ctx.fillRect(0, y, w, s);
      for (let x = 0; x < w; x += s * 2) ctx.fillRect(x, 0, s, h);
      ctx.globalAlpha = 1;
      break;
    }
    case "marble": {
      ctx.fillStyle = "#f5f5f3"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        let x = rand() * w, y = rand() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 14; k++) { x += (rand() - 0.35) * 120; y += (rand() - 0.5) * 120; ctx.lineTo(x, y); }
        ctx.strokeStyle = `rgba(110,115,125,${0.08 + rand() * 0.2})`;
        ctx.lineWidth = 0.8 + rand() * 3.5; ctx.stroke();
      }
      break;
    }
    case "wood": {
      const planks = 7, ph = h / planks;
      for (let p = 0; p < planks; p++) {
        ctx.fillStyle = shade(color, (rand() - 0.5) * 0.18); ctx.fillRect(0, p * ph, w, ph);
        for (let g = 0; g < 18; g++) {
          const gy = p * ph + rand() * ph;
          ctx.beginPath(); ctx.moveTo(0, gy);
          for (let x = 0; x <= w; x += 60) ctx.lineTo(x, gy + Math.sin(x / 90 + g) * 3);
          ctx.strokeStyle = `rgba(80,50,20,${0.05 + rand() * 0.08})`; ctx.lineWidth = 1 + rand() * 1.5; ctx.stroke();
        }
        ctx.fillStyle = "rgba(60,35,10,0.35)"; ctx.fillRect(0, p * ph, w, 3);
      }
      break;
    }
    case "linen": {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const x = rand() * w, y = rand() * h, l = 20 + rand() * 50;
        ctx.strokeStyle = rand() > 0.5 ? "rgba(255,255,255,0.18)" : "rgba(90,70,50,0.08)";
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y);
        if (rand() > 0.5) ctx.lineTo(x + l, y); else ctx.lineTo(x, y + l);
        ctx.stroke();
      }
      break;
    }
    case "tile": {
      ctx.fillStyle = "#fbfbfb"; ctx.fillRect(0, 0, w, h);
      const s = 180;
      for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
        const g = ctx.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#eef1f3");
        ctx.fillStyle = g; ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
      }
      ctx.strokeStyle = "#d3d8dc"; ctx.lineWidth = 5;
      for (let y = 0; y <= h; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let x = 0; x <= w; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      break;
    }
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, shade(color, 0.55)); g.addColorStop(1, color);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      break;
    }
    case "photo": {
      ctx.fillStyle = "#e8e2da"; ctx.fillRect(0, 0, w, h);
      if (photo) {
        const s = Math.max(w / photo.width, h / photo.height);
        const dw = photo.width * s, dh = photo.height * s;
        ctx.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
      break;
    }
    default:
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  return inset(w, h);
}

/** A cart seen from straight above: floor tiles, a wire basket, a red handle. Drawn from scratch, so it is original. */
function cart(ctx: Ctx, w: number, h: number): Zone {
  ctx.fillStyle = "#dfe3e7"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#c9ced4"; ctx.lineWidth = 4;
  for (let y = 0; y <= h; y += 240) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let x = 0; x <= w; x += 240) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

  const bx = w * 0.07, bw = w * 0.86, by = h * 0.17, bh = h * 0.66;
  // shadow
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  ctx.fillStyle = "#9aa0a8"; rr(ctx, bx, by, bw, bh, 34); ctx.fill(); ctx.restore();
  // wheels
  ctx.fillStyle = "#2b2f33";
  for (const [wx, wy] of [[bx + 40, by + bh + 22], [bx + bw - 40, by + bh + 22]]) { ctx.beginPath(); ctx.arc(wx, wy, 26, 0, Math.PI * 2); ctx.fill(); }
  // basket floor
  const g = ctx.createLinearGradient(bx, by, bx, by + bh);
  g.addColorStop(0, "#c7ccd2"); g.addColorStop(1, "#b2b8bf");
  ctx.fillStyle = g; rr(ctx, bx, by, bw, bh, 34); ctx.fill();
  // wire grid
  ctx.save(); rr(ctx, bx, by, bw, bh, 34); ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
  for (let x = bx; x <= bx + bw; x += 46) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke(); }
  for (let y = by; y <= by + bh; y += 46) { ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(60,66,74,0.35)"; ctx.lineWidth = 2;
  for (let x = bx + 3; x <= bx + bw; x += 46) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke(); }
  for (let y = by + 3; y <= by + bh; y += 46) { ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke(); }
  ctx.restore();
  // rim
  ctx.strokeStyle = "#7d848c"; ctx.lineWidth = 16; rr(ctx, bx, by, bw, bh, 34); ctx.stroke();
  ctx.strokeStyle = "#a9afb6"; ctx.lineWidth = 5; rr(ctx, bx + 4, by + 4, bw - 8, bh - 8, 30); ctx.stroke();
  // handle
  const hy = by - h * 0.055;
  ctx.strokeStyle = "#7d848c"; ctx.lineWidth = 14;
  for (const x of [bx + 60, bx + bw - 60]) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, hy); ctx.stroke(); }
  ctx.strokeStyle = "#dc2030"; ctx.lineWidth = 34; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(bx + 40, hy); ctx.lineTo(bx + bw - 40, hy); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(bx + 60, hy - 8); ctx.lineTo(bx + bw - 60, hy - 8); ctx.stroke();
  return { x: bx + 26, y: by + 26, w: bw - 52, h: bh - 52 };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** White "sticker" edge around a cut-out picture. */
export function makeSticker(src: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const r = Math.max(6, Math.round(Math.min(src.width, src.height) * 0.025));
  const c = document.createElement("canvas");
  c.width = src.width + r * 2; c.height = src.height + r * 2;
  const x = c.getContext("2d")!;
  const t = document.createElement("canvas");
  t.width = c.width; t.height = c.height;
  const tx = t.getContext("2d")!;
  for (let a = 0; a < 24; a++) tx.drawImage(src, r + Math.cos((a / 24) * Math.PI * 2) * r, r + Math.sin((a / 24) * Math.PI * 2) * r);
  tx.globalCompositeOperation = "source-in"; tx.fillStyle = "#ffffff"; tx.fillRect(0, 0, t.width, t.height);
  x.drawImage(t, 0, 0); x.drawImage(src, r, r);
  return c;
}
