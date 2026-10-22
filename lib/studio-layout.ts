/** Pure layout helpers for the Photo Studio (no canvas needed, so they can be tested). */
export type Zone = { x: number; y: number; w: number; h: number };

export const FORMATS = {
  instagram: { label: "Instagram post (4:5)", w: 1080, h: 1350 },
  pinterest: { label: "Pinterest pin (2:3)", w: 1000, h: 1500 },
  tiktok: { label: "TikTok photo post (9:16)", w: 1080, h: 1920 }
} as const;
export type FormatKey = keyof typeof FORMATS;

export type Placed = { x: number; y: number; scale: number; rot: number };

/** Small repeatable pseudo-random numbers, so a scene looks the same every time it is redrawn. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spreads n pictures over a zone in a loose grid with a slight tilt, sized to fit. */
export function autoArrange(sizes: { w: number; h: number }[], zone: Zone, seed = 7): Placed[] {
  const n = sizes.length;
  if (!n) return [];
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const cw = zone.w / cols;
  const ch = zone.h / rows;
  const rand = rng(seed);
  return sizes.map((s, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i % cols;
    const rowOffset = ((cols - inRow) * cw) / 2;
    const fit = Math.min((cw * 0.86) / Math.max(1, s.w), (ch * 0.86) / Math.max(1, s.h));
    return {
      x: zone.x + rowOffset + cw * c + cw / 2 + (rand() - 0.5) * cw * 0.06,
      y: zone.y + ch * r + ch / 2 + (rand() - 0.5) * ch * 0.06,
      scale: fit,
      rot: n === 1 ? 0 : (rand() - 0.5) * 0.35
    };
  });
}

/** Moves a point into an item's own coordinate system, to see if a tap landed on it. */
export function hitItem(px: number, py: number, it: Placed & { w: number; h: number }): boolean {
  const dx = px - it.x;
  const dy = py - it.y;
  const cos = Math.cos(-it.rot);
  const sin = Math.sin(-it.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= (it.w * it.scale) / 2 && Math.abs(ly) <= (it.h * it.scale) / 2;
}
