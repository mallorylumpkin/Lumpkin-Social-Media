import { describe, expect, it } from "vitest";
import { extractAmazonTag, parseProductUrl } from "./urls";

describe("parseProductUrl", () => {
  it("extracts and cleans an Amazon ASIN, dropping tracking parameters", () => {
    const r = parseProductUrl("https://www.amazon.com/Some-Product-Name/dp/B08N5WRWNW/ref=sr_1_3?tag=abc-20&th=1");
    expect(r.retailer).toBe("amazon");
    expect(r.retailerProductId).toBe("B08N5WRWNW");
    expect(r.cleanUrl).toBe("https://www.amazon.com/dp/B08N5WRWNW");
    expect(r.error).toBeUndefined();
  });

  it("extracts a Walmart item id", () => {
    const r = parseProductUrl("https://www.walmart.com/ip/Cozy-Blanket/123456789?athbdg=L1600");
    expect(r.retailer).toBe("walmart");
    expect(r.retailerProductId).toBe("123456789");
    expect(r.cleanUrl).toBe("https://www.walmart.com/ip/123456789");
  });

  it("refuses short links instead of following them", () => {
    const r = parseProductUrl("https://a.co/d/abc123");
    expect(r.error).toMatch(/Short links/);
  });

  it("rejects garbage and non-http protocols", () => {
    expect(parseProductUrl("not a url").error).toBeDefined();
    expect(parseProductUrl("javascript:alert(1)").error).toBeDefined();
  });

  it("treats other merchants as ShopMy-route merchants and strips query strings", () => {
    const r = parseProductUrl("https://www.example-shop.com/products/thing?utm_source=x");
    expect(r.retailer).toBe("shopmy_merchant");
    expect(r.cleanUrl).toBe("https://www.example-shop.com/products/thing");
  });
});

describe("extractAmazonTag", () => {
  it("reads the tracking id from an affiliate link", () => {
    expect(extractAmazonTag("https://www.amazon.com/dp/B08N5WRWNW?tag=mallory-ig-20")).toBe("mallory-ig-20");
    expect(extractAmazonTag("garbage")).toBeNull();
  });
});
