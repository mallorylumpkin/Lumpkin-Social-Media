"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";
import { loadPackage } from "@/lib/review";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function go(kind: "msg" | "error", m: string): never {
  revalidatePath("/calendar"); revalidatePath("/approvals"); revalidatePath("/");
  redirect(`/calendar?${kind}=${encodeURIComponent(m)}`);
}

export async function markPosted(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot record posts.");
  const id = s(formData, "id");
  const permalink = s(formData, "permalink");
  if (permalink) {
    try {
      if (new URL(permalink).protocol !== "https:") throw new Error();
    } catch {
      go("error", "The post link must be a full https:// address (or leave it blank).");
    }
  }
  const { data: item } = await supabase.from("content_calendar_items").select("id, content_version_id, social_account_id, status").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!item) go("error", "Calendar item not found.");
  if (item!.status === "published") go("msg", "Already recorded.");
  const pkg = await loadPackage(supabase, orgId, item!.content_version_id);
  if (!pkg) go("error", "Package not found.");
  const { data: rev } = await supabase.from("compliance_reviews").select("id").eq("content_version_id", item!.content_version_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { error: uErr } = await supabase.from("content_calendar_items").update({ status: "published" }).eq("id", id).eq("org_id", orgId);
  if (uErr) go("error", uErr.message.replace("publish_gate: ", "Blocked: "));

  const v = pkg!.version;
  const { data: post, error } = await supabase.from("published_posts").insert({
    org_id: orgId, calendar_item_id: id, content_version_id: v.id, social_account_id: item!.social_account_id, platform: v.platform,
    permalink: permalink || null, published_at: new Date().toISOString(), published_via: "manual", final_caption: v.caption, final_disclosure: v.disclosure_text,
    creative_snapshot: { hook: v.hook, script: v.script, shot_list: v.shot_list, on_screen_text: v.on_screen_text, voiceover: v.voiceover }, tracking_key: v.tracking_key,
    compliance_review_id: rev?.id ?? null
  }).select("id").single();
  if (error || !post) go("error", error?.message ?? "Could not record the post.");

  const links = pkg!.products.filter((p) => p.offerId).map((p, i) => ({ org_id: orgId, post_id: post!.id, product_id: p.id, offer_id: p.offerId, affiliate_link_id: p.linkId, position: i, role: i === 0 ? "primary" : "secondary" }));
  if (links.length) await supabase.from("post_product_links").insert(links);
  go("msg", "Recorded. Clicks and commissions will be matched to this post when you import reports.");
}

export async function cancelItem(formData: FormData) {
  const { supabase, orgId, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot change the calendar.");
  const { error } = await supabase.from("content_calendar_items").update({ status: "cancelled" }).eq("id", s(formData, "id")).eq("org_id", orgId).neq("status", "published");
  if (error) go("error", error.message);
  go("msg", "Removed from the calendar. The package stays approved and can be scheduled again.");
}
