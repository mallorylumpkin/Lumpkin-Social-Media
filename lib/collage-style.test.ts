import { describe, expect, it } from "vitest";
import { encodeStyle, fillTitle, isCollage, mix, normalizeStyle, parseStyle, resolveScheme } from "./collage-style";

describe("collage style", () => {
  it("round-trips a style through the stored text", () => {
    const s = normalizeStyle({ font: "modern", scheme: "custom", custom: { bg: "#112233", text: "#ffffff", accent: "#ff8800" } });
    expect(parseStyle(encodeStyle(s))).toEqual(s);
  });
  it("falls back safely on bad input", () => {
    expect(parseStyle("collage")).toEqual({ font: "classic", scheme: "cream" });
    expect(parseStyle("collage:{bad")).toEqual({ font: "classic", scheme: "cream" });
    expect(normalizeStyle({ font: "nope", scheme: "custom" })).toEqual({ font: "classic", scheme: "cream" });
  });
  it("derives a readable custom scheme", () => {
    const sc = resolveScheme({ font: "classic", scheme: "custom", custom: { bg: "#ffffff", text: "#000000", accent: "#ffee00" } });
    expect(sc.tagText).toBe("#222222");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("recognizes collages and fills titles", () => {
    expect(isCollage("collage")).toBe(true);
    expect(isCollage(null)).toBe(false);
    expect(fillTitle("Top {n} Finds", 5)).toBe("Top 5 Finds");
  });
});
