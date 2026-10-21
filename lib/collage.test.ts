import { describe, expect, it } from "vitest";
import { collageLayout, weekKey } from "./collage";

describe("collage helpers", () => {
  it("lays out 2 to 6 tiles inside the canvas without overlapping heavily", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const r = collageLayout(n, 1000, 1500);
      expect(r.length).toBe(n);
      for (const t of r) {
        expect(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000 && t.y + t.h <= 1500).toBe(true);
      }
      for (let i = 0; i < r.length; i++)
        for (let j = i + 1; j < r.length; j++) {
          const a = r[i], b = r[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(ox > 0 && oy > 0).toBe(false);
        }
    }
  });
  it("makes a stable ISO week label", () => {
    expect(weekKey(new Date("2026-10-21T12:00:00Z"))).toBe("2026-W43");
    expect(weekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
    expect(weekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });
});
