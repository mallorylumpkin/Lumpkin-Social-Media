"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";
import { extractAmazonTag, parseProductUrl, PROGRAM_FOR_RETAILER, type RetailerKey } from "@/lib/urls";
import {
  DEFAULT_PENALTIES,
  DEFAULT_WEIGHTS,
  scoreProduct,
  type ScoringInput,
  type ScoringPenalties,
  type ScoringThresholds,
  type ScoringWeights
} from "@/lib/scoring";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(/[$,]/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function addProduct(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  const back = "/products/new";
  if (!canWrite(role)) fail(back, "Your role cannot add products.");

  const title = str(formData, "title");
  const urlRaw = str(formData, "url");
  if (!title) fail(back, "Enter a product name.");
  if (!urlRaw) fail(back, "Paste the product page URL.");

  const parsed = parseProductUrl(urlRaw);
  if (parsed.error) fail(back, parsed.error);

  const retailerKey = (str(formData, "retailer") || parsed.retailer) as RetailerKey | null;
  if (!retailerKey) fail(back, "Choose a retailer.");

  const rating = num(formData, "rating");
  if (rating !== null && (rating < 0 || rating > 5)) fail(back, "Rating must be between 0 and 5.");
  const reviews = num(formData, "reviews");
  if (reviews !== null && (reviews < 0 || !Number.isInteger(reviews))) fail(back, "Review count must be a whole number.");
  const price = num(formData, "price");
  if (price !== null && price < 0) fail(back, "Price cannot be negative.");

  const { data: retailer } = await supabase.from("retailers").select("id").eq("key", retailerKey).single();
  if (!retailer) fail(back, "Retailer reference data is missing. Run migration 008.");

  if (parsed.retailerProductId) {
    const { data: dup } = await supabase
      .from("retailer_offers")
      .select("id, products(canonical_title)")
      .eq("org_id", orgId)
      .eq("retailer_id", retailer!.id)
      .eq("retailer_product_id", parsed.retailerProductId)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      const name = (dup as any).products?.canonical_title ?? "this product";
      redirect(`/products?msg=${encodeURIComponent(`Already in your catalog as "${name}". Nothing added.`)}`);
    }
  }

  if (formData.get("force") !== "on") {
    const { data: similar } = await supabase
      .from("products")
      .select("canonical_title")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .ilike("canonical_title", `%${escapeLike(title)}%`)
      .limit(1);
    if (similar && similar.length) {
      fail(back, `A similar product already exists: "${similar[0].canonical_title}". Tick "Add anyway" if it is different.`);
    }
  }

  // Validate the optional affiliate link before writing anything.
  const link = str(formData, "affiliate_link");
  let trackingId: string | null = null;
  if (link) {
    let lu: URL;
    try {
      lu = new URL(link);
    } catch {
      fail(back, "The affiliate link is not a valid URL.");
    }
    if (lu!.protocol !== "https:") fail(back, "Affiliate links must start with https://");
    if (retailerKey === "amazon") {
      trackingId = extractAmazonTag(link);
      if (!trackingId) fail(back, "This Amazon link has no tracking ID (tag=). Use a link generated from your Associates account.");
    }
  }

  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      org_id: orgId,
      canonical_title: title,
      category: str(formData, "category") || null,
      description: str(formData, "notes") || null,
      status: "candidate",
      source_type: "manual_url",
      source_url: parsed.cleanUrl,
      created_by: user.id,
      confidence: 0.5
    })
    .select("id")
    .single();
  if (pErr || !product) fail(back, pErr?.message ?? "Could not save the product.");

  const { data: offer, error: oErr } = await supabase
    .from("retailer_offers")
    .insert({
      org_id: orgId,
      product_id: product!.id,
      retailer_id: retailer!.id,
      retailer_product_id: parsed.retailerProductId,
      url: parsed.cleanUrl,
      title_at_retailer: title,
      current_price: price,
      rating,
      review_count: reviews,
      availability: "unknown",
      match_status: "confirmed",
      match_confidence: 1,
      price_verified_at: price !== null ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      source_type: "manual",
      source_url: parsed.cleanUrl
    })
    .select("id")
    .single();
  if (oErr || !offer) fail(back, oErr?.message ?? "Could not save the retailer offer.");

  if (price !== null || rating !== null) {
    await supabase.from("offer_snapshots").insert({
      org_id: orgId,
      offer_id: offer!.id,
      price,
      rating,
      review_count: reviews,
      source_type: "manual",
      source_url: parsed.cleanUrl
    });
  }

  if (link) {
    const { data: program } = await supabase
      .from("affiliate_programs")
      .select("id")
      .eq("key", PROGRAM_FOR_RETAILER[retailerKey!])
      .single();
    const { data: account } = program
      ? await supabase
          .from("affiliate_accounts")
          .select("id")
          .eq("org_id", orgId)
          .eq("program_id", program.id)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (account) {
      await supabase.from("affiliate_links").insert({
        org_id: orgId,
        offer_id: offer!.id,
        affiliate_account_id: account.id,
        url: link,
        tracking_id: trackingId,
        created_via: "manual"
      });
    }
  }

  revalidatePath("/products");
  revalidatePath("/inbox");
  revalidatePath("/");
  redirect(`/inbox?msg=${encodeURIComponent(`Added "${title}" to your research inbox.`)}`);
}

export async function setProductStatus(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  const id = str(formData, "id");
  const status = str(formData, "status");
  const back = str(formData, "back") || "/inbox";
  if (!canWrite(role)) fail(back, "Your role cannot change products.");
  if (!["candidate", "watching", "approved", "rejected", "paused", "retired"].includes(status)) fail(back, "Unknown status.");
  const { error } = await supabase.from("products").update({ status }).eq("id", id).eq("org_id", orgId);
  if (error) fail(back, error.message);
  revalidatePath("/inbox");
  revalidatePath("/products");
  revalidatePath("/");
  redirect(`${back}?msg=${encodeURIComponent(`Marked ${status}.`)}`);
}

export async function scoreProductAction(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  const id = str(formData, "id");
  const back = str(formData, "back") || "/inbox";
  if (!canWrite(role)) fail(back, "Your role cannot score products.");

  const { data: cfg } = await supabase
    .from("scoring_configs")
    .select("id, weights, penalties, thresholds")
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (!cfg) fail(back, "No active scoring configuration. Run migration 008 and create your workspace.");

  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .eq("org_id", orgId)
    .in("key", ["thresholds.price_range", "thresholds.min_rating", "thresholds.min_review_count", "thresholds.route_to_approval_score"]);
  const s = Object.fromEntries((settings ?? []).map((r: any) => [r.key, r.value]));

  const { data: offers } = await supabase
    .from("retailer_offers")
    .select("current_price, rating, review_count, commission_rate, availability, status")
    .eq("product_id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null);
  const best = (offers ?? []).filter((o: any) => o.status === "active")[0] ?? null;

  const { count: brokenCount } = await supabase
    .from("affiliate_links")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["broken", "expired"])
    .in(
      "offer_id",
      (offers ?? []).length ? (await supabase.from("retailer_offers").select("id").eq("product_id", id)).data!.map((o: any) => o.id) : ["00000000-0000-0000-0000-000000000000"]
    );

  const range = (s["thresholds.price_range"] as { min: number | null; max: number | null } | undefined) ?? { min: null, max: null };
  const input: ScoringInput = {
    rating: best?.rating !== null && best?.rating !== undefined ? Number(best.rating) : null,
    reviewCount: best?.review_count ?? null,
    price: best?.current_price !== null && best?.current_price !== undefined ? Number(best.current_price) : null,
    commissionRate: best?.commission_rate !== null && best?.commission_rate !== undefined ? Number(best.commission_rate) : null,
    availability: (best?.availability as ScoringInput["availability"]) ?? "unknown",
    priceRange: { min: range.min ?? null, max: range.max ?? null },
    purchaseIntent: null,
    trendAcceleration: null,
    audienceFit: null,
    giftability: null,
    seasonal: null,
    saturation: null,
    complianceRisk: null,
    historicalConversion: null,
    linkBroken: (brokenCount ?? 0) > 0
  };

  const thresholds: ScoringThresholds = {
    ...(cfg!.thresholds as ScoringThresholds),
    ...(s["thresholds.min_rating"] !== undefined ? { min_rating: Number(s["thresholds.min_rating"]) } : {}),
    ...(s["thresholds.min_review_count"] !== undefined ? { min_review_count: Number(s["thresholds.min_review_count"]) } : {}),
    ...(s["thresholds.route_to_approval_score"] !== undefined ? { route_to_approval_score: Number(s["thresholds.route_to_approval_score"]) } : {})
  };

  const result = scoreProduct(
    input,
    { ...DEFAULT_WEIGHTS, ...(cfg!.weights as Partial<ScoringWeights>) },
    { ...DEFAULT_PENALTIES, ...(cfg!.penalties as Partial<ScoringPenalties>) },
    thresholds
  );

  await supabase.from("product_opportunity_scores").update({ is_current: false }).eq("product_id", id).eq("org_id", orgId).eq("is_current", true);

  const { data: score, error } = await supabase
    .from("product_opportunity_scores")
    .insert({
      org_id: orgId,
      product_id: id,
      scoring_config_id: cfg!.id,
      total_score: result.total,
      confidence: result.confidence,
      confidence_level: result.confidenceLevel,
      recommended: result.recommended,
      reason_for: result.reasonFor,
      reason_against: result.reasonAgainst,
      missing_data: result.missingData,
      evidence: [{ source: "retailer_offer", note: "owner-entered listing data" }],
      expected_role: "testing",
      is_current: true
    })
    .select("id")
    .single();
  if (error || !score) fail(back, error?.message ?? "Could not save the score.");

  await supabase.from("score_components").insert(
    result.components.map((c) => ({
      org_id: orgId,
      score_id: score!.id,
      kind: c.kind,
      component_key: c.key,
      raw_value: c.rawValue,
      weight: c.weight,
      points: c.points,
      missing: c.missing,
      note: c.note
    }))
  );

  revalidatePath("/inbox");
  revalidatePath("/products");
  redirect(`${back}?msg=${encodeURIComponent(`Scored ${result.total}/100 (${result.confidenceLevel} confidence).`)}`);
}
