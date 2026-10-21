import { reviewPackage, RULES_VERSION, type PackageInput } from "@/lib/compliance";
import { withTag } from "@/lib/links";

type Sb = any;

export type LoadedPackage = {
  version: any;
  input: PackageInput;
  products: { id: string; title: string; retailerKey: string; retailerName: string; offerId: string | null; linkId: string | null; link: string | null; baseLink: string | null }[];
};

export async function loadPackage(supabase: Sb, orgId: string, versionId: string): Promise<LoadedPackage | null> {
  const { data: v } = await supabase.from("content_versions").select("*").eq("id", versionId).eq("org_id", orgId).maybeSingle();
  if (!v) return null;

  const { data: rows } = await supabase
    .from("content_idea_products")
    .select(
      "product_id, position, products(id, canonical_title, is_synthetic, retailer_offers(id, deleted_at, retailers(key, name), affiliate_links(id, url, tracking_id, status, deleted_at, created_at)))"
    )
    .eq("idea_id", v.idea_id)
    .order("position");

  const ids = (rows ?? []).map((r: any) => r.product_id);
  const [{ data: exps }, { data: accts }, { data: tpl }] = await Promise.all([
    ids.length
      ? supabase.from("owner_product_experience").select("product_id, claims_verified, owner_used, owner_tested, owner_purchased").eq("org_id", orgId).in("product_id", ids)
      : Promise.resolve({ data: [] }),
    supabase.from("affiliate_accounts").select("tracking_ids, affiliate_programs(key)").eq("org_id", orgId).is("deleted_at", null),
    v.disclosure_template_id
      ? supabase.from("disclosure_templates").select("id, status, body").eq("id", v.disclosure_template_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const amazonIds: Record<string, string> =
    (accts ?? []).find((a: any) => a.affiliate_programs?.key === "amazon_associates")?.tracking_ids ?? {};
  const channelTag: string | undefined = amazonIds[v.platform];

  const products: LoadedPackage["products"] = [];
  const reviewProducts: PackageInput["products"] = [];
  for (const r of rows ?? []) {
    const p = r.products;
    if (!p) continue;
    const offers = (p.retailer_offers ?? []).filter((o: any) => !o.deleted_at);
    const withLink = offers.find((o: any) => (o.affiliate_links ?? []).some((l: any) => !l.deleted_at && l.status === "active"));
    const offer = withLink ?? offers[0];
    const link = offer ? (offer.affiliate_links ?? []).filter((l: any) => !l.deleted_at && l.status === "active")[0] : null;
    const key = offer?.retailers?.key ?? "unknown";
    const isAmazon = key === "amazon";
    const finalLink = link ? (isAmazon && channelTag ? withTag(link.url, channelTag) : link.url) : null;
    const exp = (exps ?? []).find((e: any) => e.product_id === p.id);
    products.push({
      id: p.id, title: p.canonical_title, retailerKey: key, retailerName: offer?.retailers?.name ?? "retailer",
      offerId: offer?.id ?? null, linkId: link?.id ?? null, link: finalLink, baseLink: link?.url ?? null
    });
    reviewProducts.push({
      title: p.canonical_title, isSynthetic: !!p.is_synthetic, retailerKey: key,
      experienceVerified: !!(exp?.claims_verified && (exp.owner_used || exp.owner_tested || exp.owner_purchased)),
      affiliateUrl: finalLink, channelTagMissing: isAmazon ? !channelTag : false
    });
  }

  let missingImages: string[] | undefined;
  if (v.creative_requirements === "collage") {
    const { data: va } = await supabase.from("content_version_assets").select("position").eq("version_id", versionId);
    const have = new Set((va ?? []).map((x: any) => x.position));
    missingImages = products.filter((_, i) => !have.has(i)).map((p) => p.title);
  }

  const input: PackageInput = {
    missingImages,
    platform: v.platform, contentType: v.content_type, hook: v.hook, script: v.script, voiceover: v.voiceover, caption: v.caption, cta: v.cta,
    onScreenText: Array.isArray(v.on_screen_text) ? v.on_screen_text : [], shotList: Array.isArray(v.shot_list) ? v.shot_list : [],
    discoveryTerms: v.discovery_terms ?? [], disclosureText: v.disclosure_text,
    disclosureFromActiveTemplate: !!(tpl && tpl.status === "active" && v.disclosure_text && v.disclosure_text.includes(tpl.body.slice(0, 40))),
    products: reviewProducts
  };
  return { version: v, input, products };
}

/** Runs the rules and records the result. The database publish gate reads the newest review. */
export async function runReview(supabase: Sb, orgId: string, versionId: string) {
  const pkg = await loadPackage(supabase, orgId, versionId);
  if (!pkg) return null;
  const r = reviewPackage(pkg.input);
  const { data, error } = await supabase
    .from("compliance_reviews")
    .insert({ org_id: orgId, content_version_id: versionId, reviewer_type: "rules_engine", result: r.result, blocking_count: r.blockingCount, findings: r.findings, rules_version: RULES_VERSION })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ...r, reviewId: data.id as string };
}
