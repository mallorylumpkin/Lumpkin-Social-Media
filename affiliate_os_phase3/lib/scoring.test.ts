import { describe, expect, it } from "vitest";
import { scoreProduct, type ScoringInput } from "./scoring";

const base: ScoringInput = {
  rating: 4.7,
  reviewCount: 4000,
  price: 24.99,
  commissionRate: 0.03,
  availability: "in_stock",
  priceRange: { min: 1, max: null },
  purchaseIntent: null,
  trendAcceleration: null,
  audienceFit: null,
  giftability: null,
  seasonal: null,
  saturation: null,
  complianceRisk: null,
  historicalConversion: null,
  linkBroken: false
};

describe("scoreProduct", () => {
  it("never treats missing data as zero and reports it", () => {
    const r = scoreProduct(base);
    expect(r.missingData).toContain("trend_acceleration");
    const trend = r.components.find((c) => c.key === "trend_acceleration");
    expect(trend?.missing).toBe(true);
    expect(trend?.rawValue).toBeNull();
  });

  it("applies a weak-evidence penalty proportional to missing weight", () => {
    const r = scoreProduct(base);
    const p = r.components.find((c) => c.key === "weak_evidence");
    expect(p).toBeDefined();
    expect(p!.points).toBeLessThan(0);
    expect(r.confidenceLevel).toBe("low");
    expect(r.recommended).toBe(false);
  });

  it("recommends a product with full evidence and good numbers", () => {
    const r = scoreProduct({
      ...base,
      purchaseIntent: 85,
      trendAcceleration: 80,
      audienceFit: 90,
      giftability: 85,
      seasonal: 70
    });
    expect(r.missingData).toHaveLength(0);
    expect(r.confidenceLevel).toBe("high");
    expect(r.total).toBeGreaterThan(70);
    expect(r.recommended).toBe(true);
  });

  it("penalizes out-of-stock and broken links", () => {
    const ok = scoreProduct({ ...base, purchaseIntent: 80, trendAcceleration: 80, audienceFit: 80, giftability: 80, seasonal: 80 });
    const bad = scoreProduct({ ...base, availability: "out_of_stock", linkBroken: true, purchaseIntent: 80, trendAcceleration: 80, audienceFit: 80, giftability: 80, seasonal: 80 });
    expect(bad.total).toBeLessThan(ok.total);
    expect(bad.components.some((c) => c.key === "broken_link_low_inventory")).toBe(true);
  });

  it("caps listing quality below the owner's minimum rating", () => {
    const r = scoreProduct({ ...base, rating: 3.8 }, undefined, undefined, { min_rating: 4.0 });
    const lq = r.components.find((c) => c.key === "listing_quality");
    expect(lq!.rawValue!).toBeLessThanOrEqual(20);
  });

  it("keeps the total between 0 and 100", () => {
    const r = scoreProduct({ ...base, rating: null, reviewCount: null, price: null, commissionRate: null, availability: "unknown", saturation: 100, complianceRisk: 100, historicalConversion: "poor", linkBroken: true });
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });
});
