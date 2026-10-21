"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAdmin, requireOrg } from "@/lib/org";

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function updateSetting(formData: FormData) {
  const { supabase, orgId, role, user } = await requireOrg();
  if (!canAdmin(role)) redirect(`/settings?error=${encodeURIComponent("Only the owner or an admin can change settings.")}`);
  const key = str(formData, "key");
  let value: unknown;
  try {
    value = JSON.parse(str(formData, "value"));
  } catch {
    redirect(`/settings?error=${encodeURIComponent(`"${key}" must be valid JSON, for example 4.5 or {"min":1,"max":null}.`)}`);
  }
  const { data: current } = await supabase.from("settings").select("version").eq("org_id", orgId).eq("key", key).single();
  const { error } = await supabase
    .from("settings")
    .update({ value, is_default: false, version: (current?.version ?? 1) + 1, updated_by: user.id })
    .eq("org_id", orgId)
    .eq("key", key);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings");
  redirect(`/settings?msg=${encodeURIComponent(`Saved ${key}.`)}`);
}

export async function setAutomation(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) redirect(`/settings?error=${encodeURIComponent("Only the owner or an admin can change automation.")}`);
  const paused = formData.get("paused") === "on";
  const mode = str(formData, "mode");
  if (!["draft_only", "recommend_approve", "auto_schedule", "auto_publish"].includes(mode)) {
    redirect(`/settings?error=${encodeURIComponent("Unknown automation mode.")}`);
  }
  const { error } = await supabase.from("organizations").update({ automation_paused: paused, automation_mode: mode }).eq("id", orgId);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings");
  redirect(`/settings?msg=${encodeURIComponent("Automation settings saved.")}`);
}

export async function seedSynthetic() {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) redirect(`/settings?error=${encodeURIComponent("Only the owner or an admin can do this.")}`);
  const { error } = await supabase.rpc("seed_synthetic_products", { p_org: orgId });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/products");
  redirect(`/settings?msg=${encodeURIComponent("Added 5 synthetic test products. They are labeled and cannot be published.")}`);
}
