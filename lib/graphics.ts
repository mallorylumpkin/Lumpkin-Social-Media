export function graphicCount(platform: string, onScreenText: unknown): number {
  if (platform === "pinterest") return 1;
  const n = Array.isArray(onScreenText) ? onScreenText.length : 0;
  return Math.max(1, Math.min(8, n));
}
