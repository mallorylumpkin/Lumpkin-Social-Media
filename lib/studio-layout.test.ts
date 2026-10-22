import { describe, expect, it } from "vitest";
import { autoArrange, hitItem, rng } from "./studio-layout";

describe("studio layout", () => {
  const zone = { x: 100, y: 200, w: 800, h: 900 };
  it("keeps every arranged picture inside the zone", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const sizes = Array.from({ length: n }, () => ({ w: 600, h: 400 }));
      const out = autoArrange(sizes, zone);
      expect(out.length).toBe(n);
      out.forEach((p, i) => {
        const hw = (sizes[i].w * p.scale) / 2;
        const hh = (sizes[i].h * p.scale) / 2;
        expect(p.x - hw).toBeGreaterThanOrEqual(zone.x - 1);
        expect(p.x + hw).toBeLessThanOrEqual(zone.x + zone.w + 1);
        expect(p.y - hh).toBeGreaterThanOrEqual(zone.y - 1);
        expect(p.y + hh).toBeLessThanOrEqual(zone.y + zone.h + 1);
      });
    }
  });
  it("is repeatable", () => {
    const a = rng(3);
    const b = rng(3);
    expect(a()).toBe(b());
  });
  it("hit-tests rotated pictures", () => {
    const it = { x: 100, y: 100, scale: 1, rot: Math.PI / 2, w: 200, h: 20 };
    expect(hitItem(100, 180, it)).toBe(true);
    expect(hitItem(180, 100, it)).toBe(false);
  });
});
