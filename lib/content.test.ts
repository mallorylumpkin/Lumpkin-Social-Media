import { describe, expect, it } from "vitest";
import { composeCaption, parseDraft, templateDraft } from "./content";
import { reviewPackage } from "./compliance";

describe("content helpers", () => {
  it("parses AI output defensively", () => {
    expect(parseDraft(null)).toBeNull();
    const d = parseDraft({ hooks: ["a", "b"], script: "s", shot_list: ["x"], on_screen_text: ["t"], caption_body: "c", cta: "go", discovery_terms: ["kitchen", "#home"] });
    expect(d?.hook).toBe("a");
    expect(d?.discoveryTerms).toEqual(["#kitchen", "#home"]);
  });
  it("puts the disclosure last", () => {
    const c = composeCaption("tiktok", "DISC", { captionBody: "body", cta: "cta", discoveryTerms: ["#a"] });
    expect(c.endsWith("DISC")).toBe(true);
  });
  it("template drafts pass the rules when a disclosure is active", () => {
    const products = [{ title: "Silicone Lunch Box", category: "Kitchen", retailer: "Walmart", facts: "" }];
    for (const f of ["ig_story", "ig_carousel", "tiktok", "pin"] as const) {
      const d = templateDraft(f, products);
      const platform = f === "tiktok" ? "tiktok" : f === "pin" ? "pinterest" : "instagram";
      const disc = "Affiliate links: I may earn a commission.";
      const r = reviewPackage({
        platform, contentType: f, hook: d.hook, script: d.script, voiceover: d.voiceover, caption: composeCaption(platform, disc, d), cta: d.cta,
        onScreenText: d.onScreenText, shotList: d.shotList, discoveryTerms: d.discoveryTerms, disclosureText: disc, disclosureFromActiveTemplate: true,
        products: [{ title: "x", isSynthetic: false, retailerKey: "walmart", experienceVerified: false, affiliateUrl: "https://goto.walmart.com/a" }]
      });
      expect(r.result, f + JSON.stringify(r.findings)).not.toBe("block");
    }
  });
});
