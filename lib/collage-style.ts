// Collage look: title presets, fonts, color schemes and how a chosen style is stored. Pure code, safe for the browser too.

export const FONTS: Record<string, { label: string; note: string }> = {
  classic: { label: "Classic serif", note: "Warm and bookish" },
  modern: { label: "Modern sans", note: "Clean and bold" },
  friendly: { label: "Friendly sans", note: "Soft and casual" },
  elegant: { label: "Elegant serif", note: "Light and refined" }
};

export type Scheme = { label: string; bg: string; text: string; muted: string; frame: string; tagBg: string; tagBorder: string; tagText: string };

export const SCHEMES: Record<string, Scheme> = {
  cream: { label: "Cream & Blush", bg: "#f4efe7", text: "#3b342b", muted: "#6f6554", frame: "#cdc3b2", tagBg: "#f6d9df", tagBorder: "#e7b4c0", tagText: "#7a3b4a" },
  sage: { label: "Soft Sage", bg: "#eef2ea", text: "#2f3b2f", muted: "#5f6f5c", frame: "#c3cfbd", tagBg: "#dbe7d3", tagBorder: "#b5c9a9", tagText: "#3d5a37" },
  navy: { label: "Navy & Gold", bg: "#1f2a44", text: "#f5efe0", muted: "#d9c98f", frame: "#c9b98a", tagBg: "#c9b98a", tagBorder: "#b09f6b", tagText: "#1f2a44" },
  blush: { label: "Blush Pink", bg: "#fbe9ee", text: "#5a2a3a", muted: "#8d5566", frame: "#efc3cf", tagBg: "#ffffff", tagBorder: "#efc3cf", tagText: "#8d3a55" },
  lavender: { label: "Lavender", bg: "#efe9f7", text: "#3f2d5a", muted: "#6c5a8c", frame: "#cfc2e6", tagBg: "#e0d4f2", tagBorder: "#c6b3e3", tagText: "#4a3470" },
  sunny: { label: "Sunny Yellow", bg: "#fff6d6", text: "#4a3b10", muted: "#7d6a2a", frame: "#ecd98c", tagBg: "#ffe28a", tagBorder: "#f0c75a", tagText: "#5a4310" },
  sky: { label: "Sky Blue", bg: "#e8f2fb", text: "#1f3a56", muted: "#4f6f8f", frame: "#b9d2ea", tagBg: "#cfe3f6", tagBorder: "#a9c8e6", tagText: "#1f4a75" },
  mono: { label: "Black & White", bg: "#ffffff", text: "#111111", muted: "#555555", frame: "#d0d0d0", tagBg: "#111111", tagBorder: "#111111", tagText: "#ffffff" }
};

export type CollageStyle = { font: string; scheme: string; custom?: { bg: string; text: string; accent: string } };
export const DEFAULT_STYLE: CollageStyle = { font: "classic", scheme: "cream" };

const HEX = /^#[0-9a-f]{6}$/i;
const toRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** Blend a toward b: t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a), y = toRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
const lum = (h: string) => { const [r, g, b] = toRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

export function resolveScheme(style: CollageStyle): Scheme {
  if (style.scheme === "custom" && style.custom && HEX.test(style.custom.bg) && HEX.test(style.custom.text) && HEX.test(style.custom.accent)) {
    const { bg, text, accent } = style.custom;
    return {
      label: "Custom", bg, text, muted: mix(text, bg, 0.35), frame: mix(bg, text, 0.28), tagBg: accent, tagBorder: mix(accent, "#000000", 0.15),
      tagText: lum(accent) > 0.6 ? "#222222" : "#ffffff"
    };
  }
  return SCHEMES[style.scheme] ?? SCHEMES.cream;
}

export function normalizeStyle(raw: Partial<CollageStyle> | null | undefined): CollageStyle {
  const font = raw?.font && FONTS[raw.font] ? raw.font : DEFAULT_STYLE.font;
  const scheme = raw?.scheme === "custom" || (raw?.scheme && SCHEMES[raw.scheme]) ? (raw.scheme as string) : DEFAULT_STYLE.scheme;
  const c = raw?.custom;
  const custom = c && HEX.test(c.bg) && HEX.test(c.text) && HEX.test(c.accent) ? { bg: c.bg.toLowerCase(), text: c.text.toLowerCase(), accent: c.accent.toLowerCase() } : undefined;
  return { font, scheme: scheme === "custom" && !custom ? DEFAULT_STYLE.scheme : scheme, ...(custom ? { custom } : {}) };
}

/** Read the style from a form (font, scheme, c_bg, c_text, c_accent). */
export function styleFromForm(get: (k: string) => string): CollageStyle {
  return normalizeStyle({ font: get("font"), scheme: get("scheme"), custom: { bg: get("c_bg"), text: get("c_text"), accent: get("c_accent") } });
}

// A collage package stores its look in creative_requirements as: collage:{"font":"classic","scheme":"cream"}
export const isCollage = (v: string | null | undefined): boolean => !!v && v.startsWith("collage");
export const encodeStyle = (s: CollageStyle): string => `collage:${JSON.stringify(s)}`;
export function parseStyle(v: string | null | undefined): CollageStyle {
  if (!v || !v.startsWith("collage:")) return DEFAULT_STYLE;
  try {
    return normalizeStyle(JSON.parse(v.slice(8)));
  } catch {
    return DEFAULT_STYLE;
  }
}

export type TitlePreset = { key: string; label: string; kicker: string; title: string };
export const TITLE_PRESETS: TitlePreset[] = [
  { key: "best", label: "Top 5 Best Sellers This Week", kicker: "This Week's Favorites", title: "Top {n} Best Sellers" },
  { key: "finds", label: "Top 5 Finds This Week", kicker: "This Week's Favorites", title: "Top {n} Finds" },
  { key: "girls", label: "Top Finds for Girls", kicker: "Gift Guide", title: "Top Finds for Girls" },
  { key: "boys", label: "Top Finds for Boys", kicker: "Gift Guide", title: "Top Finds for Boys" },
  { key: "mom", label: "Top Finds for Mom", kicker: "Treat Yourself", title: "Top Finds for Mom" },
  { key: "dad", label: "Top Finds for Dad", kicker: "Gift Guide", title: "Top Finds for Dad" },
  { key: "holiday", label: "Holiday Gift Guide", kicker: "This Year's Favorites", title: "Holiday Gift Guide" },
  { key: "home", label: "Top Home Finds", kicker: "Home Favorites", title: "Top {n} Home Finds" },
  { key: "kitchen", label: "Top Kitchen Finds", kicker: "Kitchen Favorites", title: "Top {n} Kitchen Finds" },
  { key: "school", label: "Back to School Must-Haves", kicker: "Back to School", title: "Top {n} Must-Haves" },
  { key: "summer", label: "Summer Finds", kicker: "This Year's Favorite", title: "Summer Finds" }
];

/** Replace {n} with the number of products. */
export const fillTitle = (t: string, n: number) => t.replace(/\{n\}/g, String(n));
