// Amazon Creators API client (the replacement for the Product Advertising API).
// Server-side only. Credentials come from environment variables and are never sent to the browser.
//   AMAZON_CREATORS_CLIENT_ID, AMAZON_CREATORS_CLIENT_SECRET  (the Credential ID and Secret from Associates Central)
//   AMAZON_CREATORS_REGION = na (default) | eu | fe     AMAZON_MARKETPLACE = www.amazon.com (default)
//
// Amazon's rules that this code follows (verify them yourself in the Operating Agreement and Program Policies):
//  - Product images from the API may be shown only on your own site, and must not be stored or cached. This app never requests or stores them.
//  - Other API data may be cached for up to 24 hours. Prices are re-checked and carry a date/time stamp.
//  - The API offers no customer reviews or star ratings, so the app never shows them for Amazon products.

export type AmazonItem = {
  asin: string;
  title: string | null;
  features: string[];
  url: string | null;
  price: number | null;
  currency: string | null;
  availability: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  salesRank: number | null;
};

export type CreatorsResult<T> = { ok: true; data: T; fetchedAt: string } | { ok: false; error: string };

const TOKEN_URL: Record<string, string> = {
  na: "https://api.amazon.com/auth/o2/token",
  eu: "https://api.amazon.co.uk/auth/o2/token",
  fe: "https://api.amazon.co.jp/auth/o2/token"
};
const API = "https://creatorsapi.amazon/catalog/v1";

export const creatorsConfigured = () => !!(process.env.AMAZON_CREATORS_CLIENT_ID && process.env.AMAZON_CREATORS_CLIENT_SECRET);
const marketplace = () => process.env.AMAZON_MARKETPLACE || "www.amazon.com";

let cached: { token: string; exp: number } | null = null;

async function token(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!creatorsConfigured()) return { ok: false, error: "Amazon Creators API keys are not set. Add AMAZON_CREATORS_CLIENT_ID and AMAZON_CREATORS_CLIENT_SECRET in Netlify, then redeploy." };
  if (cached && cached.exp > Date.now() + 60_000) return { ok: true, token: cached.token };
  const url = TOKEN_URL[(process.env.AMAZON_CREATORS_REGION || "na").toLowerCase()] ?? TOKEN_URL.na;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env.AMAZON_CREATORS_CLIENT_ID, client_secret: process.env.AMAZON_CREATORS_CLIENT_SECRET, scope: "creatorsapi::default" })
    });
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) return { ok: false, error: "Amazon rejected the Creators API keys. Check the Credential ID and Secret in Netlify (no spaces) and that the region is right." };
      return { ok: false, error: `Amazon sign-in failed (${res.status}).` };
    }
    const data: any = await res.json();
    if (!data?.access_token) return { ok: false, error: "Amazon sign-in returned no token." };
    cached = { token: data.access_token, exp: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
    return { ok: true, token: cached.token };
  } catch {
    return { ok: false, error: "Could not reach Amazon to sign in." };
  }
}

async function call(path: string, body: Record<string, unknown>): Promise<CreatorsResult<any>> {
  const t = await token();
  if (!t.ok) return t;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${t.token}`, "content-type": "application/json", "x-marketplace": marketplace() },
      body: JSON.stringify({ marketplace: marketplace(), ...body }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) return { ok: false, error: "Amazon is limiting requests right now. Wait a minute and try again." };
      if (res.status === 401 || res.status === 403) return { ok: false, error: `Amazon refused the request (${res.status}). Your Creators API access may not be active yet, or the tracking ID does not belong to this account. ${text.slice(0, 140)}` };
      return { ok: false, error: `Amazon returned an error (${res.status}). ${text.slice(0, 160)}` };
    }
    return { ok: true, data: await res.json(), fetchedAt: new Date().toISOString() };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Amazon took too long to answer." : "Could not reach Amazon." };
  } finally {
    clearTimeout(timer);
  }
}

// No image resources are requested on purpose (Amazon does not allow storing them, and social use is outside its terms).
const RESOURCES = ["itemInfo.title", "itemInfo.features", "offersV2.listings.price", "offersV2.listings.availability", "browseNodeInfo.websiteSalesRank"];

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Reads one API item defensively. A field that is not recognised becomes null, never a guess. */
export function parseItem(it: any): AmazonItem | null {
  const asin = typeof it?.asin === "string" ? it.asin : null;
  if (!asin) return null;
  const listing = Array.isArray(it?.offersV2?.listings) ? it.offersV2.listings[0] : null;
  const priceObj = listing?.price;
  const money = priceObj?.money ?? priceObj;
  const price = num(money?.amount) ?? num(money?.value) ?? num(money?.displayAmount) ?? num(priceObj?.displayAmount);
  const avail = String(listing?.availability?.type ?? listing?.availability?.message ?? "").toUpperCase();
  const availability = /OUT/.test(avail) ? "out_of_stock" : /LOW|LIMITED|ONLY/.test(avail) ? "low_stock" : /IN_?STOCK|NOW|AVAILABLE/.test(avail) ? "in_stock" : "unknown";
  const rank = it?.browseNodeInfo?.websiteSalesRank;
  return {
    asin,
    title: it?.itemInfo?.title?.displayValue ?? null,
    features: Array.isArray(it?.itemInfo?.features?.displayValues) ? it.itemInfo.features.displayValues.slice(0, 8) : [],
    url: typeof it?.detailPageURL === "string" ? it.detailPageURL : null,
    price,
    currency: (money?.currency ?? money?.currencyCode ?? null) as string | null,
    availability,
    salesRank: num(rank?.salesRank) ?? num(rank?.displayValue) ?? null
  };
}

export async function getItems(asins: string[], partnerTag: string): Promise<CreatorsResult<AmazonItem[]>> {
  const out: AmazonItem[] = [];
  let fetchedAt = new Date().toISOString();
  for (let i = 0; i < asins.length; i += 10) {
    const r = await call("getItems", { itemIds: asins.slice(i, i + 10), itemIdType: "ASIN", partnerTag, resources: RESOURCES });
    if (!r.ok) return r;
    fetchedAt = r.fetchedAt;
    const items = r.data?.itemsResult?.items ?? r.data?.itemResults?.items ?? [];
    for (const it of items) {
      const p = parseItem(it);
      if (p) out.push(p);
    }
  }
  return { ok: true, data: out, fetchedAt };
}

export async function searchItems(opts: { keywords: string; partnerTag: string; sortBy?: string; minPrice?: number; count?: number }): Promise<CreatorsResult<AmazonItem[]>> {
  const r = await call("searchItems", {
    keywords: opts.keywords, partnerTag: opts.partnerTag, itemCount: Math.min(10, opts.count ?? 10), resources: RESOURCES,
    ...(opts.sortBy ? { sortBy: opts.sortBy } : {}), ...(opts.minPrice ? { minPrice: Math.round(opts.minPrice * 100) } : {})
  });
  if (!r.ok) return r;
  const items = r.data?.searchResult?.items ?? r.data?.searchResults?.items ?? [];
  return { ok: true, data: items.map(parseItem).filter(Boolean) as AmazonItem[], fetchedAt: r.fetchedAt };
}

/** Which of your Amazon tracking IDs to send with API calls (the first one saved). */
export async function partnerTag(supabase: any, orgId: string): Promise<string | null> {
  const { data } = await supabase.from("affiliate_accounts").select("tracking_ids, affiliate_programs(key)").eq("org_id", orgId).is("deleted_at", null);
  const amazon = (data ?? []).find((a: any) => a.affiliate_programs?.key === "amazon_associates");
  const ids = (amazon?.tracking_ids ?? {}) as Record<string, string>;
  return ids.pinterest || ids.instagram || ids.tiktok || Object.values(ids).find(Boolean) || null;
}

export const PRICE_DISCLAIMER = "Product prices and availability are accurate as of the date/time indicated and are subject to change.";
