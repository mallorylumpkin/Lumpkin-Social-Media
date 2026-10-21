// Rules engine: checks a content package before it can be approved or scheduled.
// Pure functions (no database, no network) so the rules are easy to test and read.
// These checks are a safety net, not legal advice. Wording rules come from the program terms you verify on the Compliance page.

export type Severity = "block" | "warn" | "info";
export type Finding = { rule: string; severity: Severity; detail: string; field?: string };

export type PackageInput = {
  platform: "instagram" | "tiktok" | "pinterest" | string;
  contentType: string;
  hook: string | null;
  script: string | null;
  voiceover: string | null;
  caption: string | null;
  cta: string | null;
  onScreenText: string[];
  shotList: string[];
  discoveryTerms: string[];
  disclosureText: string | null;
  /** True when the disclosure wording came from a template the owner activated. */
  disclosureFromActiveTemplate: boolean;
  products: {
    title: string;
    isSynthetic: boolean;
    retailerKey: string;
    /** Owner ticked "claims verified" for personal experience with this product. */
    experienceVerified: boolean;
    affiliateUrl: string | null;
    /** Amazon only: true when no tracking ID is saved for this channel on the Integrations page. */
    channelTagMissing?: boolean;
  }[];
};

export const RULES_VERSION = "2026-10-p3.1";

const PERSONAL = /\b(i (?:tried|tested|bought|use[ds]?|own|love|swear by|have been using|[’']ve been using|[’']ve used|[’']ve tried|[’']ve tested|got this|ordered)|we (?:tried|tested|bought|use[d]?|love|own)|my (?:family|house|home) (?:loves?|uses?)|in my experience|i can(?:[’']t| not) live without|worth every penny|changed my life|game[- ]changer for me|i personally|personally tested)\b/i;
const CHILD_PERSON = /\b(my|our) (kid|kids|child|children|son|daughter|toddler|baby|babies|little one|little ones|boys?|girls?)\b/i;
const CHILD_ON_CAMERA = /\b(child|children|kid|kids|toddler|baby|infant|son|daughter)\b[^.]{0,40}\b(face|faces|hands?|holding|using|playing|wearing|smiling|on camera|filming|filmed|opening|unboxing)\b/i;
const CHILD_ANY = /\b(child|children|kid|kids|toddler|baby|infant|son|daughter)\b/i;
const MONEY = /(\$\s?\d|\b\d+(?:\.\d{2})?\s?(?:dollars|bucks)\b|\b\d{1,2}\s?%\s?off\b)/i;
const DEAL_WORDS = /\b(on sale|sale price|deal of the day|lowest price|best price|price drop|price drops|today only|limited[- ]time|clearance|lightning deal|while supplies last|only \$)/i;
const HEALTH = /\b(cures?|treats?|heals?|prevents?|clinically proven|doctor[- ]recommended|fda[- ]approved|lose weight|weight loss|anti[- ]aging|detox|boosts? immunity|diagnos\w+|relieves? pain|reduces? anxiety)\b/i;
const ABSOLUTE = /\b(guaranteed|never fails?|always works|#1\b|number one|best ever|perfect for everyone|100%|miracle|life[- ]changing|works for everyone)\b/i;

function all(p: PackageInput): { field: string; text: string }[] {
  return [
    { field: "hook", text: p.hook ?? "" },
    { field: "script", text: p.script ?? "" },
    { field: "voiceover", text: p.voiceover ?? "" },
    { field: "caption", text: p.caption ?? "" },
    { field: "cta", text: p.cta ?? "" },
    { field: "on_screen_text", text: p.onScreenText.join("\n") }
  ];
}

export function reviewPackage(p: PackageInput): { result: "pass" | "warn" | "block"; blockingCount: number; findings: Finding[] } {
  const f: Finding[] = [];
  const add = (rule: string, severity: Severity, detail: string, field?: string) => f.push({ rule, severity, detail, field });
  const caption = p.caption ?? "";
  const experienceOk = p.products.length > 0 && p.products.every((x) => x.experienceVerified);

  // 1. Disclosure
  const disc = (p.disclosureText ?? "").trim();
  if (!disc) {
    add("disclosure_missing", "block", "No disclosure. Activate your disclosure wording on the Compliance page, then regenerate or edit this package.", "caption");
  } else {
    if (!p.disclosureFromActiveTemplate) add("disclosure_unverified", "block", "The disclosure did not come from a wording you activated on the Compliance page.", "caption");
    if (!caption.includes(disc.slice(0, 40))) add("disclosure_not_in_caption", "block", "The disclosure wording must appear in the caption text.", "caption");
    else if (p.platform !== "pinterest" && caption.indexOf(disc.slice(0, 40)) > 110) add("disclosure_hidden", "warn", "Put the disclosure within the first line or two so it shows before 'more'.", "caption");
  }

  // 2. Products, links, rights
  if (p.products.length === 0) add("no_product", "block", "No product is attached to this package.");
  for (const pr of p.products) {
    if (pr.isSynthetic) add("synthetic_product", "block", `"${pr.title}" is practice test data and cannot be published.`);
    if (!pr.affiliateUrl) add("link_missing", "block", `"${pr.title}" has no affiliate link saved. Add your link on the product before approving.`);
    else if (pr.retailerKey === "amazon" && !/[?&]tag=/.test(pr.affiliateUrl)) add("amazon_tag_missing", "block", `The Amazon link for "${pr.title}" has no tracking ID (tag=).`);
    if (pr.retailerKey === "amazon" && pr.channelTagMissing) add("amazon_channel_id_missing", "block", `Save your Amazon tracking ID for ${p.platform} on the Integrations page first.`);
    if (pr.retailerKey === "amazon" && !/amazon associate/i.test(caption) && p.platform !== "tiktok" && !/amazon associate/i.test(disc)) {
      add("amazon_statement", "warn", "Amazon links normally need the Amazon Associate statement. Make sure your activated wording includes it.", "caption");
    }
  }
  const hasAmazon = p.products.some((x) => x.retailerKey === "amazon");

  // 3. Text rules across every field
  for (const { field, text } of all(p)) {
    if (!text) continue;
    if (PERSONAL.test(text) && !experienceOk) add("personal_claim", "block", `Sounds like personal experience ("${(text.match(PERSONAL) ?? [""])[0]}"). Only allowed when you have tried the product and ticked it as verified. Reword it.`, field);
    if (CHILD_PERSON.test(text)) add("child_reference", "block", `Refers to your own child ("${(text.match(CHILD_PERSON) ?? [""])[0]}"). No children in posts for now. Reword it around the product.`, field);
    if (MONEY.test(text) || DEAL_WORDS.test(text)) {
      add("price_claim", hasAmazon ? "block" : "warn", `Contains a price or deal claim ("${(text.match(MONEY) ?? text.match(DEAL_WORDS) ?? [""])[0]}"). Prices change; say "check the link for today's price".`, field);
    }
    if (HEALTH.test(text)) add("health_claim", "block", `Health or medical claim ("${(text.match(HEALTH) ?? [""])[0]}"). Remove it.`, field);
    if (ABSOLUTE.test(text)) add("absolute_claim", "warn", `Strong claim ("${(text.match(ABSOLUTE) ?? [""])[0]}") that you cannot support. Soften it.`, field);
  }

  // 4. Children must not be shown
  for (const line of p.shotList) {
    if (CHILD_ON_CAMERA.test(line)) add("child_on_camera", "block", `Shot list shows a child: "${line.slice(0, 80)}". Show only the product.`, "shot_list");
    else if (CHILD_ANY.test(line)) add("child_in_shot", "warn", `Shot list mentions a child: "${line.slice(0, 80)}". Make sure only the product is shown.`, "shot_list");
  }

  // 5. Platform limits
  const len = caption.length;
  if (p.platform === "instagram" && len > 2200) add("caption_too_long", "block", `Caption is ${len} characters; Instagram allows 2,200.`, "caption");
  if (p.platform === "tiktok" && len > 2200) add("caption_too_long", "warn", `Caption is ${len} characters; keep TikTok captions under 2,200.`, "caption");
  if (p.platform === "pinterest") {
    if (len > 800) add("caption_too_long", "block", `Pin description is ${len} characters; Pinterest allows 800.`, "caption");
    if ((p.hook ?? "").length > 100) add("title_too_long", "block", `Pin title is ${(p.hook ?? "").length} characters; Pinterest allows 100.`, "hook");
  }
  if (p.discoveryTerms.length > 30) add("too_many_tags", "warn", "More than 30 hashtags/keywords.", "discovery_terms");

  // 6. Reminders that always apply
  add("media_rights", "info", "Create the visuals yourself (screen recordings, text graphics, your own product photos). Do not reuse other creators' videos or copy retailer images unless the program allows it.");

  const blockingCount = f.filter((x) => x.severity === "block").length;
  const result = blockingCount > 0 ? "block" : f.some((x) => x.severity === "warn") ? "warn" : "pass";
  return { result, blockingCount, findings: f };
}
