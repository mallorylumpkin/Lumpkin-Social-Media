// Content package helpers: prompt building, safe parsing of AI output, caption assembly, and a no-AI draft.

export type Platform = "instagram" | "tiktok" | "pinterest";
export type Format = "ig_story" | "ig_carousel" | "tiktok" | "pin";

export const FORMATS: Record<Format, { label: string; platform: Platform; contentType: string; multi: boolean }> = {
  ig_story: { label: "Instagram story sequence (5 frames)", platform: "instagram", contentType: "story_sequence", multi: false },
  ig_carousel: { label: "Instagram multi-product post", platform: "instagram", contentType: "carousel", multi: true },
  tiktok: { label: "TikTok video", platform: "tiktok", contentType: "video", multi: false },
  pin: { label: "Pinterest pin", platform: "pinterest", contentType: "pin", multi: false }
};

export const ANGLES: Record<string, string> = {
  problem_solution: "Problem and solution: a small everyday annoyance and how this product fixes it",
  gift_idea: "Gift idea: who this makes a great gift for",
  budget_find: "Smart find: why it is good value (never state a price)",
  busy_life: "Busy-life hack: how it makes a chaotic day a little easier",
  roundup: "Roundup: several finds in one theme"
};

export type ProductFacts = { title: string; category: string | null; retailer: string; facts: string };

export type Draft = {
  hooks: string[];
  hook: string;
  script: string;
  shotList: string[];
  voiceover: string;
  onScreenText: string[];
  captionBody: string;
  cta: string;
  discoveryTerms: string[];
  pinTitle: string;
};

const strs = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : x == null ? "" : String(x))).filter(Boolean).slice(0, max) : [];
const s = (v: unknown, max = 2400): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const PROMPT_VERSION = "p3.1";

export const SYSTEM_PROMPT = `You write short-form social content for Mallory, an upbeat "glass half full" mom with a chaotic life and a warm, funny personality. Voice: friendly, positive, light humor, never snarky, never pushy.
HARD RULES:
- Faceless content only: shots show products, hands-free flat lays, screen recordings, and text on screen. No people's faces and NO children on camera.
- Use ONLY the product name and the facts provided. Do not invent features, materials, sizes, ratings, results or comparisons. If few facts are given, keep claims general.
- Never state prices, discounts, deals or "on sale". Say "check the link for today's price" if needed.
- Never claim Mallory bought, tried, tested, owns or uses the product, and never say "my kids", "my family" or similar. Write as recommendations and ideas ("this could make...", "great for...").
- No health or medical claims. No guarantees, "#1" or "best ever".
- Do not write any affiliate disclosure; the app adds it.
- Return ONLY JSON in the requested shape.`;

export function buildPrompt(format: Format, angle: string, products: ProductFacts[]): string {
  const list = products
    .map((p, i) => `${i + 1}. ${p.title} (category: ${p.category ?? "unknown"}; sold at ${p.retailer}). Facts from the listing: ${p.facts || "none provided, keep it general"}`)
    .join("\n");
  const shape: Record<Format, string> = {
    ig_story: `A 5-frame Instagram story sequence. "on_screen_text": exactly 5 short strings (one per frame, last frame = call to action to tap the link sticker). "shot_list": exactly 5 strings describing each frame's visual. "script": 2 sentences on the story arc. "voiceover": "" . "hooks": 3 options for frame 1. "caption_body": "" .`,
    ig_carousel: `One Instagram multi-product post (carousel). "on_screen_text": cover slide text, then one slide per product (in order), then a closing slide. "shot_list": one visual description per slide. "caption_body": friendly caption (under 900 characters) mentioning each product by name. "hooks": 3 options for the cover. "script": "" . "voiceover": "" .`,
    tiktok: `A 20 to 30 second TikTok. "hooks": 4 opening lines (first 2 seconds). "script": the beat-by-beat script. "voiceover": the words spoken. "shot_list": 4 to 6 faceless shots. "on_screen_text": 3 to 5 text overlays. "caption_body": under 300 characters.`,
    pin: `One Pinterest pin. "pin_title": under 90 characters, keyword-rich. "caption_body": description under 450 characters with natural keywords. "hooks": 3 alternative titles. "shot_list": 1 to 3 image ideas (vertical 2:3). "on_screen_text": 1 to 3 text overlays. "script": "" . "voiceover": "" .`
  };
  return `Angle: ${ANGLES[angle] ?? ANGLES.problem_solution}
Products:
${list}

Task: ${shape[format]}
Always include "cta" (one short line pointing to the link), and "discovery_terms" (5 to 10 relevant hashtags or search keywords).
JSON keys: hooks, script, shot_list, voiceover, on_screen_text, caption_body, cta, discovery_terms, pin_title.`;
}

export function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hooks = strs(o.hooks, 5);
  const d: Draft = {
    hooks,
    hook: hooks[0] ?? s(o.pin_title, 100),
    script: s(o.script),
    shotList: strs(o.shot_list),
    voiceover: s(o.voiceover),
    onScreenText: strs(o.on_screen_text),
    captionBody: s(o.caption_body),
    cta: s(o.cta, 200),
    discoveryTerms: strs(o.discovery_terms, 30).map((t) => (t.startsWith("#") || /\s/.test(t) ? t : `#${t}`)),
    pinTitle: s(o.pin_title, 100)
  };
  if (!d.hook && !d.captionBody && !d.script) return null;
  return d;
}

/** Build the final caption: body, call to action and tags, with the disclosure as the very last line (owner's choice). */
export function composeCaption(platform: Platform, disclosure: string | null, d: Pick<Draft, "captionBody" | "cta" | "discoveryTerms">): string {
  const parts: string[] = [];
  if (d.captionBody) parts.push(d.captionBody);
  if (d.cta) parts.push(d.cta);
  if (d.discoveryTerms.length) parts.push(d.discoveryTerms.slice(0, platform === "pinterest" ? 5 : 10).join(" "));
  if (disclosure) parts.push(disclosure);
  return parts.join("\n\n");
}

/** Plain template used when AI is off, rate-limited, or you just want a fast starting point. */
export function templateDraft(format: Format, products: ProductFacts[]): Draft {
  const names = products.map((p) => p.title);
  const first = names[0] ?? "this find";
  const fact = products[0]?.facts.split("\n").map((x) => x.trim()).filter(Boolean)[0];
  const tag = (products[0]?.category ?? "finds").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const terms = [`#${tag}`, "#founditonline", "#momfinds", "#giftideas", "#everydayfinds"];
  const base = { hooks: [`Okay, this one made my list: ${first}`, `A small fix for a chaotic day: ${first}`, `Quick find worth a look: ${first}`], discoveryTerms: terms };
  if (format === "ig_story")
    return { ...base, hook: base.hooks[0], script: "Tease it, show it, say who it is for, point to the link.", shotList: ["Close-up of the product name on a clean surface", "Product from a new angle", "Text card: who it is great for", "Text card: one reason it is handy", "Link sticker card"], voiceover: "", onScreenText: [base.hooks[0], first, fact ?? "A handy little find", "Great for busy days", "Tap the link to see it!"], captionBody: "", cta: "Tap the link to take a look!", pinTitle: "" };
  if (format === "ig_carousel")
    return { ...base, hook: `${names.length} finds worth a look`, script: "", shotList: ["Cover card", ...names.map((n) => `Product visual for ${n}`), "Closing card"], voiceover: "", onScreenText: [`${names.length} finds worth a look`, ...names, "Links are in my storefront"], captionBody: `A few finds that caught my eye: ${names.join(", ")}.`, cta: "Find the links in my storefront and bio!", pinTitle: "" };
  if (format === "pin")
    return { ...base, hook: `${first}: handy find`.slice(0, 100), script: "", shotList: ["Vertical image: product on a clean background with a text title"], voiceover: "", onScreenText: [first], captionBody: `${first}. ${fact ?? "A handy find for everyday life."} Tap through to see details.`, cta: "Tap through to see it.", pinTitle: `${first}: handy find`.slice(0, 100) };
  return { ...base, hook: base.hooks[0], script: `Beat 1: show ${first}. Beat 2: say the one fact. Beat 3: who it is for. Beat 4: point to the link.`, shotList: ["Close-up of the product", "Hands-free flat lay", "Text card with the key fact", "Link card"], voiceover: `${base.hooks[0]}. ${fact ?? "It is a handy little find."} Link is in my bio.`, onScreenText: [first, fact ?? "Handy find", "Link in bio"], captionBody: `${first}: a handy find.`, cta: "Link in my bio!", pinTitle: "" };
}

export function trackingKey(platform: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `mlk-${platform.slice(0, 2)}-${ymd}-${Math.random().toString(36).slice(2, 8)}`;
}
