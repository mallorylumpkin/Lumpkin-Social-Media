// Explainable opportunity scoring (Agent C, MVP version).
// Rules:
//  * A component with no data is marked missing. It is never treated as zero.
//  * The score is computed over the weight that has data, then a weak-evidence penalty
//    removes points in proportion to how much weight is missing.
//  * Every number is returned with the reason, so the dashboard can explain it.

export interface ScoringWeights {
  purchase_intent: number;
  trend_acceleration: number;
  audience_fit: number;
  giftability: number;
  listing_quality: number;
  commission: number;
  price_value: number;
  inventory: number;
  seasonal: number;
}

export interface ScoringPenalties {
  saturation: number;
  compliance_risk: number;
  weak_evidence: number;
  poor_historical_conversion: number;
  broken_link_low_inventory: number;
}

export interface ScoringThresholds {
  min_rating?: number;
  min_review_count?: number;
  route_to_approval_score?: number;
}

export interface ScoringInput {
  rating: number | null;
  reviewCount: number | null;
  price: number | null;
  commissionRate: number | null;
  availability: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  priceRange: { min: number | null; max: number | null };
  // Optional signals from other agents; null means unavailable.
  purchaseIntent: number | null; // 0..100
  trendAcceleration: number | null; // 0..100
  audienceFit: number | null; // 0..100
  giftability: number | null; // 0..100
  seasonal: number | null; // 0..100
  saturation: number | null; // 0..100, higher = more saturated
  complianceRisk: number | null; // 0..100
  historicalConversion: "poor" | "ok" | "good" | null;
  linkBroken: boolean;
}

export interface ComponentResult {
  key: string;
  kind: "component" | "penalty";
  rawValue: number | null;
  weight: number | null;
  points: number; // signed
  missing: boolean;
  note: string;
}

export interface ScoreResult {
  total: number;
  confidence: number;
  confidenceLevel: "low" | "medium" | "high";
  components: ComponentResult[];
  missingData: string[];
  reasonFor: string;
  reasonAgainst: string;
  recommended: boolean;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  purchase_intent: 20,
  trend_acceleration: 15,
  audience_fit: 15,
  giftability: 10,
  listing_quality: 10,
  commission: 10,
  price_value: 10,
  inventory: 5,
  seasonal: 5
};

export const DEFAULT_PENALTIES: ScoringPenalties = {
  saturation: 15,
  compliance_risk: 25,
  weak_evidence: 15,
  poor_historical_conversion: 15,
  broken_link_low_inventory: 20
};

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

function listingQuality(rating: number | null, reviews: number | null, t: ScoringThresholds): { v: number | null; note: string } {
  if (rating === null || reviews === null) return { v: null, note: "rating or review count unavailable" };
  // Rating 3.5 -> 0, 5.0 -> 100; review volume saturates around 5,000.
  const ratingPart = clamp(((rating - 3.5) / 1.5) * 100);
  const volumePart = clamp((Math.log10(Math.max(reviews, 1)) / Math.log10(5000)) * 100);
  let v = 0.65 * ratingPart + 0.35 * volumePart;
  const notes = [`rating ${rating}, ${reviews} reviews`];
  if (t.min_rating !== undefined && rating < t.min_rating) {
    v = Math.min(v, 20);
    notes.push(`below minimum rating ${t.min_rating}`);
  }
  if (t.min_review_count !== undefined && reviews < t.min_review_count) {
    v = Math.min(v, 30);
    notes.push(`below minimum review count ${t.min_review_count}`);
  }
  return { v, note: notes.join("; ") };
}

function commissionValue(rate: number | null): { v: number | null; note: string } {
  if (rate === null) return { v: null, note: "commission rate unavailable" };
  // 1% -> 25, 4% -> 100.
  return { v: clamp((rate / 0.04) * 100), note: `commission ${(rate * 100).toFixed(1)}%` };
}

function priceValue(price: number | null, range: { min: number | null; max: number | null }): { v: number | null; note: string } {
  if (price === null) return { v: null, note: "price unavailable" };
  const { min, max } = range;
  if (min !== null && price < min) return { v: 20, note: `price $${price} is under the $${min} minimum` };
  if (max !== null && price > max) return { v: 20, note: `price $${price} is over the $${max} maximum` };
  // Sweet spot for gifts: cheaper is easier to buy impulsively. $15 -> 100, $150 -> 40.
  const v = clamp(100 - Math.max(0, price - 15) * (60 / 135));
  return { v, note: `price $${price}` };
}

function inventoryValue(a: ScoringInput["availability"]): { v: number | null; note: string } {
  switch (a) {
    case "in_stock":
      return { v: 100, note: "in stock" };
    case "low_stock":
      return { v: 50, note: "low stock" };
    case "out_of_stock":
      return { v: 0, note: "out of stock" };
    default:
      return { v: null, note: "availability unknown" };
  }
}

export function scoreProduct(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  penalties: ScoringPenalties = DEFAULT_PENALTIES,
  thresholds: ScoringThresholds = {}
): ScoreResult {
  const lq = listingQuality(input.rating, input.reviewCount, thresholds);
  const cm = commissionValue(input.commissionRate);
  const pv = priceValue(input.price, input.priceRange);
  const iv = inventoryValue(input.availability);

  const raw: Record<keyof ScoringWeights, { v: number | null; note: string }> = {
    purchase_intent: { v: input.purchaseIntent, note: input.purchaseIntent === null ? "no buying-intent evidence yet" : "from intent evidence" },
    trend_acceleration: { v: input.trendAcceleration, note: input.trendAcceleration === null ? "no trend observations yet" : "from trend observations" },
    audience_fit: { v: input.audienceFit, note: input.audienceFit === null ? "audience fit not assessed" : "from audience match" },
    giftability: { v: input.giftability, note: input.giftability === null ? "giftability not assessed" : "from giftability assessment" },
    listing_quality: lq,
    commission: cm,
    price_value: pv,
    inventory: iv,
    seasonal: { v: input.seasonal, note: input.seasonal === null ? "seasonal timing not assessed" : "from seasonal calendar" }
  };

  const keys = Object.keys(weights) as (keyof ScoringWeights)[];
  const totalWeight = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const components: ComponentResult[] = [];
  let availableWeight = 0;
  let weightedSum = 0;
  const missingData: string[] = [];

  for (const k of keys) {
    const { v, note } = raw[k];
    const w = weights[k];
    if (v === null) {
      components.push({ key: k, kind: "component", rawValue: null, weight: w, points: 0, missing: true, note });
      missingData.push(k);
    } else {
      availableWeight += w;
      weightedSum += v * w;
      components.push({ key: k, kind: "component", rawValue: round2(v), weight: w, points: 0, missing: false, note });
    }
  }

  // Normalize over the weight that has data, then give each component its share of the base score.
  const base = availableWeight > 0 ? weightedSum / availableWeight : 0;
  for (const c of components) {
    if (!c.missing && c.rawValue !== null && c.weight !== null && availableWeight > 0) {
      c.points = round2((c.rawValue * c.weight) / availableWeight);
    }
  }

  const missingFraction = 1 - availableWeight / totalWeight;
  let total = base;

  const addPenalty = (key: string, points: number, note: string) => {
    components.push({ key, kind: "penalty", rawValue: null, weight: null, points: -round2(points), missing: false, note });
    total -= points;
  };

  if (missingFraction > 0) {
    addPenalty("weak_evidence", penalties.weak_evidence * missingFraction, `${Math.round(missingFraction * 100)}% of the weighted evidence is missing`);
  }
  if (input.saturation !== null && input.saturation > 0) {
    addPenalty("saturation", penalties.saturation * (input.saturation / 100), `saturation ${input.saturation}/100`);
  }
  if (input.complianceRisk !== null && input.complianceRisk > 0) {
    addPenalty("compliance_risk", penalties.compliance_risk * (input.complianceRisk / 100), `compliance risk ${input.complianceRisk}/100`);
  }
  if (input.historicalConversion === "poor") {
    addPenalty("poor_historical_conversion", penalties.poor_historical_conversion, "past posts of this product converted poorly");
  }
  if (input.linkBroken || input.availability === "out_of_stock") {
    addPenalty("broken_link_low_inventory", penalties.broken_link_low_inventory, input.linkBroken ? "link is broken" : "product is out of stock");
  }

  total = round2(clamp(total));
  const confidence = round2(availableWeight / totalWeight);
  const confidenceLevel: ScoreResult["confidenceLevel"] = confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
  const threshold = thresholds.route_to_approval_score ?? 60;

  const strengths = components
    .filter((c) => c.kind === "component" && !c.missing && (c.rawValue ?? 0) >= 70)
    .map((c) => c.key.replace(/_/g, " "));
  const weaknesses = components
    .filter((c) => c.kind === "component" && !c.missing && (c.rawValue ?? 100) < 40)
    .map((c) => c.key.replace(/_/g, " "));

  return {
    total,
    confidence,
    confidenceLevel,
    components,
    missingData,
    reasonFor: strengths.length ? `Strong: ${strengths.join(", ")}.` : "No component is strong yet.",
    reasonAgainst: [
      weaknesses.length ? `Weak: ${weaknesses.join(", ")}.` : "",
      missingData.length ? `Missing evidence: ${missingData.map((m) => m.replace(/_/g, " ")).join(", ")}.` : ""
    ]
      .filter(Boolean)
      .join(" ") || "No major concerns found.",
    recommended: total >= threshold && confidenceLevel !== "low"
  };
}
