"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAdmin, canWrite, requireOrg } from "@/lib/org";
import { createCollage, rankTopProducts, weekKey } from "@/lib/collage";
import { DEFAULT_STYLE, fillTitle, normalizeStyle, styleFromForm, TITLE_PRESETS, type CollageStyle } from "@/lib/collage-style";
import { getSetting } from "@/lib/generate";

function go(kind: "msg" | "error", m: string, path = "/collages"): never {
  revalidatePath("/approvals"); revalidatePath("/collages"); revalidatePath("/");
  redirect(`${path}?${kind}=${encodeURIComponent(m)}`);
}

export async function makeWeeklyNow() {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot create collages.");
  const { products, basis } = await rankTopProducts(supabase, orgId, 5, true);
  if (products.length < 3) go("error", "I need at least 3 approved products that have an uploaded image. Add images on the Product Images page first.");
  const style = normalizeStyle(await getSetting<Partial<CollageStyle>>(supabase, orgId, "collage.style", DEFAULT_STYLE));
  const subtitle = basis === "sales" ? `Top ${products.length} Best Sellers` : basis === "clicks" ? `Top ${products.length} Most Clicked` : `Top ${products.length} Picks`;
  const res = await createCollage({
    supabase, orgId, userId: user.id, productIds: products.map((p) => p.id), title: "This Week's Favorites", subtitle, labels: products.map((_, i) => `#${i + 1}`),
    platforms: ["pinterest", "instagram"], keyPrefix: `mlk-collage-${weekKey()}`, style
  });
  if ("error" in res) go("error", res.error === "This collage already exists." ? "This week's collage was already made. Find it in the Approval Queue." : res.error);
  go("msg", `Made this week's collage (${subtitle}). Review it in the Approval Queue.`, "/approvals");
}

export async function makeCollage(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot create collages.");
  const get = (k: string) => String(formData.get(k) ?? "");
  const ids = formData.getAll("product_id").map(String);
  const preset = TITLE_PRESETS.find((p) => p.key === get("preset"));
  const title = (preset ? fillTitle(preset.kicker, ids.length) : get("title").trim().slice(0, 40)) || "My Favorites";
  const subtitle = (preset ? fillTitle(preset.title, ids.length) : get("subtitle").trim().slice(0, 40)) || "";
  const platforms = formData.getAll("platform").map(String).filter((p): p is "pinterest" | "instagram" => p === "pinterest" || p === "instagram");
  const labels = ids.map((id) => get(`label_${id}`).trim().slice(0, 28));
  const style = styleFromForm(get);

  if (get("save_default") === "on") {
    if (!canAdmin(role)) go("error", "Only the owner or an admin can save the default style.");
    const { error } = await supabase.from("settings").upsert(
      { org_id: orgId, key: "collage.style", value: style, is_default: false, description: "Your default collage font and colors", updated_by: user.id },
      { onConflict: "org_id,key" }
    );
    if (error) go("error", `Could not save the default style: ${error.message}`);
  }

  const res = await createCollage({ supabase, orgId, userId: user.id, productIds: ids, title, subtitle, labels, platforms, keyPrefix: `mlk-collage-m-${Math.random().toString(36).slice(2, 9)}`, style });
  if ("error" in res) go("error", res.error);
  go("msg", get("save_default") === "on" ? "Collage created and your style saved as the default. Review it in the Approval Queue." : "Collage created. Review it in the Approval Queue.", "/approvals");
}

export async function saveDefaultStyle(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canAdmin(role)) go("error", "Only the owner or an admin can save the default style.");
  const style = styleFromForm((k) => String(formData.get(k) ?? ""));
  const { error } = await supabase.from("settings").upsert(
    { org_id: orgId, key: "collage.style", value: style, is_default: false, description: "Your default collage font and colors", updated_by: user.id },
    { onConflict: "org_id,key" }
  );
  if (error) go("error", `Could not save: ${error.message}`);
  go("msg", "Saved. New collages (including the weekly one) will use this style.");
}

type ImportResult = { ok: false; error: string };

/** A finished collage image you made elsewhere (for example in Amazon's Create Content tool) becomes a package for approval. */
export async function importCollage(formData: FormData): Promise<ImportResult | void> {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) return { ok: false, error: "Your role cannot import collages." };
  const get = (k: string) => String(formData.get(k) ?? "");
  const path = get("path");
  if (!path.startsWith(`${orgId}/imports/`)) return { ok: false, error: "That upload does not belong to this workspace." };
  if (formData.get("rights") !== "yes") return { ok: false, error: "Tick the box confirming you have the right to use and share this image." };
  const ids = formData.getAll("product_id").map(String);
  if (ids.length < 1 || ids.length > 6) return { ok: false, error: "Pick the product or products shown in the collage (1 to 6) so their links and disclosure can be checked." };
  const platforms = formData.getAll("platform").map(String).filter((p): p is "pinterest" | "instagram" => p === "pinterest" || p === "instagram");
  if (!platforms.length) return { ok: false, error: "Choose Pinterest, Instagram or both." };
  const source = ["owner_provided", "retailer_permitted"].includes(get("source")) ? get("source") : "retailer_permitted";

  const { data: asset, error: aErr } = await supabase
    .from("content_assets")
    .insert({
      org_id: orgId, asset_type: "image", source_type: source, license_status: "documented", license_ref: get("note").trim().slice(0, 300) || "Owner confirmed rights at import",
      storage_ref: path, rights_verified_by: user.id, rights_verified_at: new Date().toISOString()
    })
    .select("id").single();
  if (aErr || !asset) return { ok: false, error: aErr?.message ?? "Could not save the image." };

  const title = get("title").trim().slice(0, 40) || "Top Finds";
  const res = await createCollage({
    supabase, orgId, userId: user.id, productIds: ids, title, subtitle: get("subtitle").trim().slice(0, 40) || "Shop the look", labels: [], platforms,
    keyPrefix: `mlk-collage-i-${Math.random().toString(36).slice(2, 9)}`, style: DEFAULT_STYLE, importedAssetId: asset.id as string
  });
  if ("error" in res) return { ok: false, error: res.error };
  go("msg", "Imported. Review the caption and approve it in the Approval Queue.", "/approvals");
}
