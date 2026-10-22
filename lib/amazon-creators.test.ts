import { describe, expect, it } from "vitest";
import { parseItem } from "./amazon-creators";

describe("parseItem", () => {
  it("reads title, url, price and rank", () => {
    const it = parseItem({
      asin: "B0TEST1234", detailPageURL: "https://www.amazon.com/dp/B0TEST1234?tag=x-20", itemInfo: { title: { displayValue: "Thing" }, features: { displayValues: ["a", "b"] } },
      offersV2: { listings: [{ price: { money: { amount: 12.5, currency: "USD" } }, availability: { type: "IN_STOCK" } }] }, browseNodeInfo: { websiteSalesRank: { salesRank: 120 } }
    });
    expect(it?.title).toBe("Thing");
    expect(it?.price).toBe(12.5);
    expect(it?.availability).toBe("in_stock");
    expect(it?.salesRank).toBe(120);
    expect(it?.features.length).toBe(2);
  });
  it("never guesses: unknown shapes become null", () => {
    const it = parseItem({ asin: "B0TEST1234", offersV2: { listings: [{ price: { weird: 1 } }] } });
    expect(it?.price).toBeNull();
    expect(it?.title).toBeNull();
    expect(it?.availability).toBe("unknown");
    expect(parseItem({})).toBeNull();
  });
});
