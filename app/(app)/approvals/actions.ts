"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { canAdmin, canWrite, requireOrg } from "@/lib/org";
import { runReview } from "@/lib/review";
import { createPackage } from "@/lib/generate";
import type { Format } from "@/lib/content";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
function go(path: string, kind: "msg" | "error", m: string): never {
  revalidatePath("/approvals"); revalidatePath("/calendar"); revalidatePath("/");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(m)}`);
}

function formatFor(platform: string, contentType: string): Format {
  if (platform === "instagram") return contentType === "story_sequence" ? "ig_story" : "ig_carousel";
  return platform === "pinterest" ? "pin" : "tiktok";
}

async function approveOne(supabase: any, orgId: string, userId: string, id: string, batchId: string | null): Promise<string | null> {
  const { data: v } = await supabase.from("content_versions").select("id, status").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!v) return "Package not found.";
  if (v.status === "approved") return null;
  const r = await runReview(supabase, orgId, id);
  if (!r) return "Package not found.";
  if (r.result === "block") return `Blocked by the rules check: ${r.findings.filter((f) => f.severity === "block").map((f) => f.detail).join(" ")}`;
  const { error } = await supabase.from("content_approvals").insert({ org_id: orgId, content_version_id: id, decision: "approved", decided_by: userId, batch_id: batchId, claims_verified_snapshot: {} });
  if (error) return error.message;
  const { error: uErr } = await supabase.from("content_versions").update({ status: "approved" }).eq("id", id).eq("org_id", orgId);
  return uErr ? uErr.message : null;
}

export async function approveVersion(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canAdmin(role)) go("/approvals", "error", "Only the owner or an admin can approve.");
  const err = await approveOne(supabase, orgId, user.id, s(formData, "id"), null);
  if (err) go("/approvals", "error", err);
  go("/approvals", "msg", "Approved. Now pick an account and time under 'Schedule'.");
}

export async function batchApprove(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canAdmin(role)) go("/approvals", "error", "Only the owner or an admin can approve.");
  const ids = formData.getAll("id").map(String);
  const batch = randomUUID();
  let ok = 0, skipped = 0;
  for (const id of ids) {
    const { data: rev } = await supabase.from("compliance_reviews").select("result").eq("content_version_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rev?.result !== "pass") { skipped++; continue; }
    const err = await approveOne(supabase, orgId, user.id, id, batch);
    if (err) skipped++; else ok++;
  }
  go("/approvals", ok ? "msg" : "error", `Approved ${ok}. ${skipped ? `${skipped} skipped because they have warnings or blockers: review those one by one.` : ""}`);
}

export async function rejectVersion(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canAdmin(role)) go("/approvals", "error", "Only the owner or an admin can reject.");
  const id = s(formData, "id");
  const { error } = await supabase.from("content_approvals").insert({ org_id: orgId, content_version_id: id, decision: "rejected", decided_by: user.id, notes: s(formData, "notes") || null });
  if (error) go("/approvals", "error", error.message);
  await supabase.from("content_versions").update({ status: "rejected" }).eq("id", id).eq("org_id", orgId);
  go("/approvals", "msg", "Rejected.");
}

export async function regenerateVersion(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) go("/approvals", "error", "Your role cannot regenerate content.");
  const id = s(formData, "id");
  const mode = formData.get("mode") === "template" ? "template" : "ai";
  const { data: v } = await supabase.from("content_versions").select("id, idea_id, version_no, platform, content_type, claim_sources").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!v) go("/approvals", "error", "Package not found.");
  const { data: idea } = await supabase.from("content_ideas").select("angle").eq("id", v.idea_id).single();
  const { data: prods } = await supabase.from("content_idea_products").select("product_id, position, products(canonical_title)").eq("idea_id", v.idea_id).order("position");
  const facts: Record<string, string> = {};
  for (const p of prods ?? []) {
    const hit = (v.claim_sources ?? []).find((c: any) => c.product === (p as any).products?.canonical_title);
    if (hit) facts[p.product_id] = hit.claim;
  }
  const { data: latest } = await supabase.from("content_versions").select("version_no").eq("idea_id", v.idea_id).eq("platform", v.platform).order("version_no", { ascending: false }).limit(1).single();
  const res = await createPackage({
    supabase, orgId, userId: user.id, format: formatFor(v.platform, v.content_type), angle: idea?.angle ?? "problem_solution", mode,
    productIds: (prods ?? []).map((p: any) => p.product_id), facts, regenerateOf: { versionId: v.id, ideaId: v.idea_id, versionNo: latest?.version_no ?? v.version_no }
  });
  if ("error" in res) go("/approvals", "error", res.error);
  go("/approvals", "msg", "Made a fresh version. The old one was retired.");
}

export async function saveEdit(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  const id = s(formData, "id");
  const back = `/approvals/${id}`;
  if (!canWrite(role)) go(back, "error", "Your role cannot edit content.");
  const { error } = await supabase.from("content_versions").update({
    hook: s(formData, "hook") || null, caption: s(formData, "caption") || null, script: s(formData, "script") || null, voiceover: s(formData, "voiceover") || null,
    cta: s(formData, "cta") || null, on_screen_text: lines(s(formData, "on_screen_text")), shot_list: lines(s(formData, "shot_list")),
    discovery_terms: s(formData, "discovery_terms").split(/[\s,]+/).filter(Boolean), status: "in_review", generated_by: "owner"
  }).eq("id", id).eq("org_id", orgId);
  if (error) go(back, "error", error.message);
  const r = await runReview(supabase, orgId, id);
  go("/approvals", r?.result === "block" ? "error" : "msg", r?.result === "block" ? "Saved, but the rules check still blocks it. See the card." : "Saved and re-checked. It needs your approval again.");
}

export async function scheduleVersion(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canWrite(role)) go("/approvals", "error", "Your role cannot schedule.");
  const id = s(formData, "id");
  const accountId = s(formData, "account_id");
  const when = new Date(s(formData, "scheduled_iso"));
  if (!accountId) go("/approvals", "error", "Choose an account.");
  if (Number.isNaN(when.getTime())) go("/approvals", "error", "Choose a date and time.");
  const { data: v } = await supabase.from("content_versions").select("platform").eq("id", id).eq("org_id", orgId).single();
  const { data: acct } = await supabase.from("social_accounts").select("id, platform, status").eq("id", accountId).eq("org_id", orgId).single();
  if (!v || !acct || acct.platform !== v.platform) go("/approvals", "error", "That account is for a different platform.");
  if (acct!.status !== "active") go("/approvals", "error", "Finish setting up that account on Integrations first.");
  // Manual-assist: the app prepares everything; you post it and tap "Mark posted". The database gate still checks approval, disclosure and rules.
  const { error } = await supabase.from("content_calendar_items").insert({
    org_id: orgId, content_version_id: id, social_account_id: accountId, scheduled_for: when.toISOString(), status: "manual_pending", publish_method: "manual",
    idempotency_key: `${id}:${accountId}`
  });
  if (error) go("/approvals", "error", error.code === "23505" ? "That package is already scheduled for this account." : error.message.replace("publish_gate: ", "Blocked: "));
  go("/calendar", "msg", "Scheduled. It will appear on the Calendar with a copy-ready package.");
}
