"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Adds a suggested Amazon product to your Research Inbox, with your own affiliate link built from your saved tracking ID. */
export async function addSuggested(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  const back = `/discover?q=${encodeURIComponent(s(formData, "q"))}`;
  const fail = (m: string): never => redirect(`${back}&error=${encodeURIComponent(m)}`);
  if (!canWrite(role)) fail("Your role cannot add products.");

  const asin = s(formData, "asin").toUpperCase();
  const title = s(formData, "title").slice(0, 250);
  const tag = s(formData, "tag");
  if (!/^[A-Z0-9]{10}$/.test(asin) || !title) fail("Missing product details.");
  const priceRaw = s(formData, "price");
  const price = priceRaw !== "" && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null;
  const availability = ["in_stock", "low_stock", "out_of_stock", "unknown"].includes(s(formData, "availability")) ? s(formData, "availability") : "unknown";

  const { data: retailer } = await supabase.from("retailers").select("id").eq("key", "amazon").single();
  if (!retailer) fail("Retailer reference data is missing. Run migration 008.");
  const { data: dup } = await supabase.from("retailer_offers").select("id").eq("org_id", orgId).eq("retailer_id", retailer!.id).eq("retailer_product_id", asin).is("deleted_at", null).maybeSingle();
  if (dup) redirect(`${back}&msg=${encodeURIComponent("Already in your catalog.")}`);

  const cleanUrl = `https://www.amazon.com/dp/${asin}`;
  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({ org_id: orgId, canonical_title: title, status: "candidate", source_type: "import", source_url: cleanUrl, created_by: user.id, confidence: 0.5 })
    .select("id").single();
  if (pErr || !product) fail(pErr?.message ?? "Could not save the product.");

  const now = new Date().toISOString();
  const { data: offer, error: oErr } = await supabase
    .from("retailer_offers")
    .insert({
      org_id: orgId, product_id: product!.id, retailer_id: retailer!.id, retailer_product_id: asin, url: cleanUrl, title_at_retailer: title, current_price: price, availability,
      match_status: "confirmed", match_confidence: 1, price_verified_at: price !== null ? now : null, last_checked_at: now, source_type: "official_api", source_url: cleanUrl
    })
    .select("id").single();
  if (oErr || !offer) fail(oErr?.message ?? "Could not save the offer.");
  if (price !== null) await supabase.from("offer_snapshots").insert({ org_id: orgId, offer_id: offer!.id, price, availability, source_type: "official_api" });

  if (tag) {
    const { data: program } = await supabase.from("affiliate_programs").select("id").eq("key", "amazon_associates").single();
    const { data: account } = program ? await supabase.from("affiliate_accounts").select("id").eq("org_id", orgId).eq("program_id", program.id).is("deleted_at", null).limit(1).maybeSingle() : { data: null };
    if (account) {
      await supabase.from("affiliate_links").insert({ org_id: orgId, offer_id: offer!.id, affiliate_account_id: account.id, url: `${cleanUrl}?tag=${encodeURIComponent(tag)}`, tracking_id: tag, created_via: "api" });
    }
  }
  revalidatePath("/inbox");
  revalidatePath("/products");
  redirect(`${back}&msg=${encodeURIComponent(`Added "${title.slice(0, 60)}" to your Research Inbox.`)}`);
}
