// Starting-point posting windows. These are GUESSES until your own analytics exist (Phase 5), and the app labels them that way.
export const STARTER_SLOTS: Record<string, number[]> = {
  // local hours of day
  instagram_story: [8, 12, 15, 18, 20],
  instagram_post: [12],
  tiktok: [12, 19, 21],
  pinterest: [20]
};
export function slotKey(platform: string, contentType: string) {
  if (platform === "instagram") return contentType === "story_sequence" ? "instagram_story" : "instagram_post";
  return platform;
}
