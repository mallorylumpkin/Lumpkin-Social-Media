"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAdmin, requireOrg } from "@/lib/org";

const PLATFORMS = ["instagram", "tiktok", "pinterest", "facebook", "youtube"];

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
function done(message: string): never {
  revalidatePath("/integrations");
  revalidatePath("/");
  redirect(`/integrations?msg=${encodeURIComponent(message)}`);
}
function fail(message: string): never {
  redirect(`/integrations?error=${encodeURIComponent(message)}`);
}

export async function saveTrackingIds(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) fail("Only the owner or an admin can change affiliate settings.");
  const id = str(formData, "id");

  const { data: row } = await supabase.from("affiliate_accounts").select("tracking_ids").eq("id", id).eq("org_id", orgId).single();
  const tracking: Record<string, string> = { ...((row?.tracking_ids as Record<string, string>) ?? {}) };
  const registered: string[] = [];

  for (const p of ["instagram", "tiktok", "pinterest"]) {
    const v = str(formData, `tid_${p}`);
    if (v) tracking[p] = v;
    else delete tracking[p];
    if (formData.get(`reg_${p}`) === "on") registered.push(p);
  }

  const { error } = await supabase
    .from("affiliate_accounts")
    .update({ tracking_ids: tracking, registered_channels: registered, owner_confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) fail(error.message);
  done("Affiliate settings saved.");
}

export async function updateSocialAccount(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) fail("Only the owner or an admin can change social accounts.");
  const handle = str(formData, "handle").replace(/^@/, "");
  if (!handle || /\s/.test(handle)) fail("Enter the handle without spaces.");
  let status = str(formData, "status");
  if (!["planned", "active", "paused", "disconnected", "error"].includes(status)) fail("Unknown status.");
  // Entering a real handle on a planned account activates it.
  if (status === "planned") status = "active";
  const { error } = await supabase
    .from("social_accounts")
    .update({ handle, status, paused: status === "paused" })
    .eq("id", str(formData, "id"))
    .eq("org_id", orgId);
  if (error) fail(error.message);
  done("Account updated.");
}

export async function addSocialAccount(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) fail("Only the owner or an admin can add social accounts.");
  const platform = str(formData, "platform");
  const handle = str(formData, "handle").replace(/^@/, "");
  if (!PLATFORMS.includes(platform)) fail("Choose a platform.");
  if (!handle || /\s/.test(handle)) fail("Enter the handle without spaces.");

  const { data: brand } = await supabase.from("brands").select("id").eq("org_id", orgId).eq("is_default", true).maybeSingle();
  const { error } = await supabase.from("social_accounts").insert({
    org_id: orgId,
    brand_id: brand?.id ?? null,
    platform,
    handle,
    account_type: str(formData, "account_type") || null,
    status: "active",
    publishing_method: platform === "instagram" ? "api" : "manual"
  });
  if (error) fail(error.code === "23505" ? "That account is already connected." : error.message);
  done(`Added ${platform} account @${handle}. Remember to add it in Amazon Associates before posting Amazon links there.`);
}

export async function addBoard(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canAdmin(role)) fail("Only the owner or an admin can add boards.");
  const name = str(formData, "name");
  if (!name) fail("Enter the board name.");
  const { error } = await supabase.from("social_destinations").insert({
    org_id: orgId,
    social_account_id: str(formData, "social_account_id"),
    kind: "board",
    name
  });
  if (error) fail(error.message);
  done(`Board "${name}" added.`);
}
