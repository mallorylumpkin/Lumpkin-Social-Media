import { describe, expect, it } from "vitest";
import { reviewPackage, type PackageInput } from "./compliance";

const base: PackageInput = {
  platform: "tiktok", contentType: "video", hook: "Tiny fix for a messy counter", script: "Show the product close up.",
  voiceover: "This little organizer keeps the counter tidy.", caption: "Affiliate links: I may earn a commission.\n\nA tidy counter in two minutes.",
  cta: "Link in my bio", onScreenText: ["Tidy counter"], shotList: ["Close-up of the organizer on a counter"], discoveryTerms: ["#kitchenfinds"],
  disclosureText: "Affiliate links: I may earn a commission.", disclosureFromActiveTemplate: true,
  products: [{ title: "Organizer", isSynthetic: false, retailerKey: "walmart", experienceVerified: false, affiliateUrl: "https://goto.walmart.com/x" }]
};

describe("reviewPackage", () => {
  it("passes a clean package with only an info note", () => {
    const r = reviewPackage(base);
    expect(r.result).toBe("pass");
    expect(r.blockingCount).toBe(0);
  });
  it("blocks missing disclosure", () => {
    expect(reviewPackage({ ...base, disclosureText: null }).result).toBe("block");
  });
  it("blocks personal experience unless verified", () => {
    const p = { ...base, voiceover: "I tried this and I love it." };
    expect(reviewPackage(p).findings.some((x) => x.rule === "personal_claim")).toBe(true);
    const ok = { ...p, products: [{ ...base.products[0], experienceVerified: true }] };
    expect(reviewPackage(ok).findings.some((x) => x.rule === "personal_claim")).toBe(false);
  });
  it("blocks own-child references and child on camera", () => {
    expect(reviewPackage({ ...base, script: "My kids love it" }).result).toBe("block");
    expect(reviewPackage({ ...base, shotList: ["Child holding the toy"] }).result).toBe("block");
  });
  it("blocks price claims for Amazon but only warns elsewhere", () => {
    const text = { ...base, caption: base.caption + " Only $9.99!" };
    expect(reviewPackage(text).result).toBe("warn");
    const amz = { ...text, products: [{ ...base.products[0], retailerKey: "amazon", affiliateUrl: "https://www.amazon.com/dp/B0?tag=x-20" }] };
    expect(reviewPackage(amz).result).toBe("block");
  });
  it("blocks Amazon link without tag, health claims, synthetic products", () => {
    const amz = { ...base, products: [{ ...base.products[0], retailerKey: "amazon", affiliateUrl: "https://www.amazon.com/dp/B0" }] };
    expect(reviewPackage(amz).findings.some((x) => x.rule === "amazon_tag_missing")).toBe(true);
    expect(reviewPackage({ ...base, script: "Cures back pain" }).result).toBe("block");
    expect(reviewPackage({ ...base, products: [{ ...base.products[0], isSynthetic: true }] }).result).toBe("block");
  });
  it("enforces pinterest limits", () => {
    const pin = { ...base, platform: "pinterest", hook: "x".repeat(101) };
    expect(reviewPackage(pin).findings.some((x) => x.rule === "title_too_long")).toBe(true);
  });
});
