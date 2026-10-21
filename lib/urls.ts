// Product URL parsing. Never fetches a page: it only reads the URL the owner pasted.

export type RetailerKey = "amazon" | "walmart" | "shopmy_merchant";

export interface ParsedProductUrl {
  retailer: RetailerKey | null;
  retailerProductId: string | null;
  cleanUrl: string;
  error?: string;
}

const SHORT_HOSTS = new Set(["a.co", "amzn.to", "amzn.com", "walmrt.us", "wmt.co"]);

export function parseProductUrl(raw: string): ParsedProductUrl {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { retailer: null, retailerProductId: null, cleanUrl: raw.trim(), error: "That is not a valid URL." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { retailer: null, retailerProductId: null, cleanUrl: raw.trim(), error: "Only http(s) links are accepted." };
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  if (SHORT_HOSTS.has(host)) {
    return {
      retailer: null,
      retailerProductId: null,
      cleanUrl: u.toString(),
      error: "Short links cannot be read without opening them. Paste the full product page URL instead."
    };
  }

  if (host === "amazon.com" || host.endsWith(".amazon.com")) {
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    if (!m) {
      return { retailer: "amazon", retailerProductId: null, cleanUrl: u.origin + u.pathname, error: "Could not find the 10-character product code (ASIN) in this Amazon URL." };
    }
    const asin = m[1].toUpperCase();
    return { retailer: "amazon", retailerProductId: asin, cleanUrl: `https://www.amazon.com/dp/${asin}` };
  }

  if (host === "walmart.com" || host.endsWith(".walmart.com")) {
    const m = u.pathname.match(/\/ip\/(?:[^/]+\/)?(\d{5,})/);
    if (!m) {
      return { retailer: "walmart", retailerProductId: null, cleanUrl: u.origin + u.pathname, error: "Could not find the item number in this Walmart URL." };
    }
    return { retailer: "walmart", retailerProductId: m[1], cleanUrl: `https://www.walmart.com/ip/${m[1]}` };
  }

  // Any other merchant (typically one reached through ShopMy). Query strings are dropped so no tracking data is stored.
  return {
    retailer: "shopmy_merchant",
    retailerProductId: null,
    cleanUrl: u.origin + u.pathname
  };
}

/** Pulls the Amazon tracking ID (tag=) from an affiliate link the owner generated. */
export function extractAmazonTag(link: string): string | null {
  try {
    return new URL(link).searchParams.get("tag");
  } catch {
    return null;
  }
}

export const PROGRAM_FOR_RETAILER: Record<RetailerKey, string> = {
  amazon: "amazon_associates",
  walmart: "walmart_creator",
  shopmy_merchant: "shopmy"
};
