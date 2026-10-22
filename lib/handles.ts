/** Text shown at the bottom of a collage, per platform. */
export const DEFAULT_HANDLES: Record<string, string> = {
  instagram: "mallory.marie.lumpkin",
  tiktok: "Mallorymarielumpkin"
};

export function collageFooter(platform: string, saved?: string | null): string {
  if (platform === "pinterest") return "Mallory Lumpkin";
  const s = (saved ?? "").trim().replace(/^@/, "");
  const handle = s && s.toLowerCase() !== "planned" ? s : DEFAULT_HANDLES[platform];
  return handle ? `@${handle}` : "Mallory Lumpkin";
}
