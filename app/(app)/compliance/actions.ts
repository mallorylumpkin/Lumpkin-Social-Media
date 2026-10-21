"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAdmin, requireOrg } from "@/lib/org";

export async function saveDisclosure(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) redirect(`/compliance?error=${encodeURIComponent("Only the owner or an admin can change disclosures.")}`);
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const verified = formData.get("verified") === "on";
  if (body.length < 10) redirect(`/compliance?error=${encodeURIComponent("The disclosure is too short.")}`);

  const patch: Record<string, unknown> = { body };
  if (verified) {
    patch.status = "active";
    patch.verification_status = "verified";
  } else {
    patch.status = "draft";
    patch.verification_status = "unverified";
  }
  const { data: cur } = await supabase.from("disclosure_templates").select("version").eq("id", id).eq("org_id", orgId).single();
  patch.version = (cur?.version ?? 1) + 1;

  const { error } = await supabase.from("disclosure_templates").update(patch).eq("id", id).eq("org_id", orgId);
  if (error) redirect(`/compliance?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/compliance");
  revalidatePath("/");
  redirect(`/compliance?msg=${encodeURIComponent(verified ? "Saved and activated." : "Saved as a draft.")}`);
}
