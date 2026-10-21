/** Amazon lets each channel use its own tracking ID through the tag= parameter. Only your own saved ID is ever applied. */
export function withTag(url: string, tag: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("tag", tag);
    return u.toString();
  } catch {
    return url;
  }
}
