"use server";

import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";

type Result = { ok: true } | { ok: false; error: string };

/** Records an image the browser already uploaded to private storage, together with your rights confirmation. */
export async function registerImage(formData: FormData): Promise<Result> {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) return { ok: false, error: "Your role cannot add images." };
  const productId = String(formData.get("product_id") ?? "");
  const path = String(formData.get("path") ?? "");
  const source = String(formData.get("source") ?? "owner_provided");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (formData.get("rights") !== "yes") return { ok: false, error: "Tick the box confirming you have the right to use this image." };
  if (!["owner_provided", "retailer_permitted", "official_product_media"].includes(source)) return { ok: false, error: "Choose where the image came from." };
  if (!path.startsWith(`${orgId}/${productId}/`)) return { ok: false, error: "That upload does not belong to this product." };

  const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("org_id", orgId).maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };

  const { error } = await supabase.from("content_assets").insert({
    org_id: orgId, product_id: productId, asset_type: "image", source_type: source, license_status: "documented", license_ref: note || "Owner confirmed rights at upload",
    storage_ref: path, rights_verified_by: user.id, rights_verified_at: new Date().toISOString()
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/images");
  return { ok: true };
}

export async function removeImage(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canWrite(role)) return;
  const id = String(formData.get("id") ?? "");
  const { data: a } = await supabase.from("content_assets").select("storage_ref").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!a) return;
  await supabase.from("content_assets").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("org_id", orgId);
  if (a.storage_ref) await supabase.storage.from("product-images").remove([a.storage_ref]);
  revalidatePath("/images");
}
