// Collage helpers: layout maths, "top products" ranking, and package creation.
import { activeDisclosure, getSetting } from "@/lib/generate";
import { runReview } from "@/lib/review";

type Sb = any;

export type Rect = { x: number; y: number; w: number; h: number; rot: number };

// Fractions of the content area: [x, y, w, h, rotationDegrees]. Staggered, like a styled flat-lay board.
const FR: Record<number, number[][]> = {
  2: [[0, 0, 0.64, 0.47, -1.5], [0.36, 0.53, 0.64, 0.47, 1.5]],
  3: [[0, 0, 0.5, 0.58, -1], [0.54, 0, 0.46, 0.42, 1.5], [0.2, 0.62, 0.6, 0.38, -1]],
  4: [[0, 0, 0.48, 0.48, -1.5], [0.52, 0.04, 0.48, 0.44, 1.5], [0, 0.52, 0.48, 0.48, 1], [0.52, 0.52, 0.48, 0.48, -1]],
  5: [[0, 0, 0.48, 0.32, -1.5], [0, 0.35, 0.48, 0.30, 1], [0, 0.68, 0.48, 0.32, -1], [0.52, 0, 0.48, 0.48, 1.5], [0.52, 0.51, 0.48, 0.49, -1]],
  6: [[0, 0, 0.48, 0.31, -1.5], [0.52, 0.02, 0.48, 0.3, 1.5], [0, 0.345, 0.48, 0.31, 1], [0.52, 0.365, 0.48, 0.3, -1], [0, 0.69, 0.48, 0.31, -1], [0.52, 0.69, 0.48, 0.31, 1.5]]
};

export function collageLayout(n: number, width: number, height: number): Rect[] {
  const count = Math.max(2, Math.min(6, n));
  const left = 110, right = 110, top = 300, bottom = 170;
  const cw = width - left - right;
  const ch = height - top - bottom;
  return FR[count].slice(0, n).map(([x, y, w, h, rot]) => ({ x: Math.round(left + x * cw), y: Math.round(top + y * ch), w: Math.round(w * cw), h: Math.round(h * ch), rot }));
}

/** ISO-style week label in UTC, e.g. 2026-W43. */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}

export type Ranked = { id: string; title: string; assetId: string | null; storageRef: string | null };
export type Basis = "sales" | "clicks" | "score";

/** Top products by your own results if you have imported any, otherwise by opportunity score. */
export async function rankTopProducts(supabase: Sb, orgId: string, n: number, requireImage: boolean): Promise<{ products: Ranked[]; basis: Basis }> {
  const { data: prods } = await supabase
    .from("products")
    .select("id, canonical_title, is_synthetic, retailer_offers(id, deleted_at)")
    .eq("org_id", orgId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .limit(300);
  const list: any[] = (prods ?? []).filter((p: any) => !p.is_synthetic);
  if (!list.length) return { products: [], basis: "score" };
  const ids = list.map((p) => p.id);

  const { data: assets } = await supabase
    .from("content_assets")
    .select("id, product_id, storage_ref, created_at")
    .eq("org_id", orgId)
    .eq("asset_type", "image")
    .eq("license_status", "documented")
    .is("deleted_at", null)
    .not("storage_ref", "is", null)
    .in("product_id", ids)
    .order("created_at", { ascending: false });
  const asset = new Map<string, any>();
  for (const a of assets ?? []) if (!asset.has(a.product_id)) asset.set(a.product_id, a);

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: conv } = await supabase
    .from("affiliate_conversions")
    .select("product_id, commission, units, status")
    .eq("org_id", orgId)
    .gte("ordered_on", since)
    .neq("status", "reversed")
    .in("product_id", ids);
  const sales = new Map<string, number>();
  for (const c of conv ?? []) sales.set(c.product_id, (sales.get(c.product_id) ?? 0) + Number(c.commission ?? 0) * 1000 + Number(c.units ?? 0));

  let basis: Basis = "score";
  let rank = new Map<string, number>();
  if ([...sales.values()].some((v) => v > 0)) {
    basis = "sales";
    rank = sales;
  } else {
    const offerToProduct = new Map<string, string>();
    for (const p of list) for (const o of p.retailer_offers ?? []) if (!o.deleted_at) offerToProduct.set(o.id, p.id);
    const { data: clicks } = await supabase.from("affiliate_clicks").select("offer_id, clicks").eq("org_id", orgId).gte("clicked_on", since).in("offer_id", [...offerToProduct.keys()]);
    const byProduct = new Map<string, number>();
    for (const c of clicks ?? []) {
      const pid = offerToProduct.get(c.offer_id);
      if (pid) byProduct.set(pid, (byProduct.get(pid) ?? 0) + Number(c.clicks ?? 0));
    }
    if ([...byProduct.values()].some((v) => v > 0)) {
      basis = "clicks";
      rank = byProduct;
    } else {
      const { data: scores } = await supabase.from("product_opportunity_scores").select("product_id, total_score").eq("org_id", orgId).eq("is_current", true).in("product_id", ids);
      for (const s of scores ?? []) rank.set(s.product_id, Number(s.total_score ?? 0));
    }
  }

  const out: Ranked[] = list
    .filter((p) => !requireImage || asset.has(p.id))
    .sort((a, b) => (rank.get(b.id) ?? -1) - (rank.get(a.id) ?? -1))
    .slice(0, n)
    .map((p) => ({ id: p.id, title: p.canonical_title, assetId: asset.get(p.id)?.id ?? null, storageRef: asset.get(p.id)?.storage_ref ?? null }));
  return { products: out, basis };
}

const short = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…");

export type CollageArgs = {
  supabase: Sb; orgId: string; userId: string; productIds: string[]; title: string; subtitle: string; labels: string[];
  platforms: ("pinterest" | "instagram")[]; keyPrefix: string;
};

export async function createCollage(a: CollageArgs): Promise<{ versionIds: string[] } | { error: string }> {
  const { supabase, orgId } = a;
  if (a.productIds.length < 2 || a.productIds.length > 6) return { error: "Pick 2 to 6 products for a collage." };
  if (!a.platforms.length) return { error: "Choose at least one platform." };

  const { data: prods } = await supabase.from("products").select("id, canonical_title, retailer_offers(deleted_at, retailers(key))").eq("org_id", orgId).in("id", a.productIds).is("deleted_at", null);
  if (!prods || prods.length !== a.productIds.length) return { error: "Could not load the selected products." };
  const ordered = a.productIds.map((id) => prods.find((p: any) => p.id === id)!);
  const retailerKeys = ordered.map((p: any) => (p.retailer_offers ?? []).find((o: any) => !o.deleted_at)?.retailers?.key).filter(Boolean) as string[];

  const { data: assets } = await supabase
    .from("content_assets").select("id, product_id, created_at").eq("org_id", orgId).eq("asset_type", "image").eq("license_status", "documented")
    .is("deleted_at", null).not("storage_ref", "is", null).in("product_id", a.productIds).order("created_at", { ascending: false });
  const best = new Map<string, string>();
  for (const x of assets ?? []) if (!best.has(x.product_id)) best.set(x.product_id, x.id);

  const { data: idea, error: iErr } = await supabase
    .from("content_ideas")
    .insert({ org_id: orgId, title: short(a.title, 120), angle: "roundup", format_hint: "collage", expected_role: "revenue", status: "ready" })
    .select("id").single();
  if (iErr || !idea) return { error: iErr?.message ?? "Could not save the collage idea." };
  await supabase.from("content_idea_products").insert(a.productIds.map((pid, i) => ({ idea_id: idea.id, product_id: pid, org_id: orgId, position: i })));

  const versionIds: string[] = [];
  for (const platform of a.platforms) {
    const isPin = platform === "pinterest";
    const disc = await activeDisclosure(supabase, orgId, platform, retailerKeys);
    const names = ordered.map((p: any, i: number) => `${i + 1}. ${short(p.canonical_title, isPin ? 55 : 70)}`).join("\n");
    const body = `${a.title}: ${a.subtitle}\n\n${names}`;
    const cta = isPin ? "Tap through to shop these finds." : "Find the links in my storefront and bio!";
    const tags = isPin ? "#shoppingfinds #giftideas #homefinds" : "#founditonline #topfinds #shoppingfinds #giftideas #momfinds";
    const caption = [body, cta, tags, disc.text].filter(Boolean).join("\n\n");
    const { data: ver, error } = await supabase
      .from("content_versions")
      .insert({
        org_id: orgId, idea_id: idea.id, version_no: 1, platform, content_type: isPin ? "pin" : "static_post", status: "in_review",
        hook: short(`${a.title}: ${a.subtitle}`, 100), caption, cta, disclosure_template_id: disc.templateId, disclosure_text: disc.text,
        discovery_terms: tags.split(" "), on_screen_text: [a.title, a.subtitle, ...a.productIds.map((_, i) => a.labels[i] ?? "")],
        claim_sources: [], generated_by: "agent", prompt_version: "collage1", model_ref: "collage", creative_requirements: "collage",
        tracking_key: `${a.keyPrefix}-${platform.slice(0, 2)}`
      })
      .select("id").single();
    if (error || !ver) {
      if (!versionIds.length) await supabase.from("content_ideas").delete().eq("id", idea.id).eq("org_id", orgId);
      return { error: error?.code === "23505" ? "This collage already exists." : error?.message ?? "Could not save the collage." };
    }
    const links = a.productIds.map((pid, i) => (best.has(pid) ? { version_id: ver.id, asset_id: best.get(pid)!, org_id: orgId, role: "collage_tile", position: i } : null)).filter(Boolean);
    if (links.length) await supabase.from("content_version_assets").insert(links as any[]);
    versionIds.push(ver.id as string);
  }
  for (const id of versionIds) await runReview(supabase, orgId, id);
  return { versionIds };
}

/** Builds this week's "top 5" collage the first time the app is opened each week. Never throws. */
export async function ensureWeeklyCollage(supabase: Sb, orgId: string, userId: string): Promise<"created" | "exists" | "skipped"> {
  try {
    if (!(await getSetting<boolean>(supabase, orgId, "collage.weekly_enabled", true))) return "skipped";
    const wk = weekKey();
    const prefix = `mlk-collage-${wk}`;
    const { data: existing } = await supabase.from("content_versions").select("id").eq("org_id", orgId).like("tracking_key", `${prefix}-%`).limit(1);
    if (existing && existing.length) return "exists";
    const { products, basis } = await rankTopProducts(supabase, orgId, 5, true);
    if (products.length < 3) return "skipped";
    const subtitle = basis === "sales" ? `Top ${products.length} Best Sellers` : basis === "clicks" ? `Top ${products.length} Most Clicked` : `Top ${products.length} Picks`;
    const res = await createCollage({ supabase, orgId, userId, productIds: products.map((p) => p.id), title: "This Week's Favorites", subtitle, labels: products.map((_, i) => `#${i + 1}`), platforms: ["pinterest", "instagram"], keyPrefix: prefix });
    return "error" in res ? "skipped" : "created";
  } catch {
    return "skipped";
  }
}
