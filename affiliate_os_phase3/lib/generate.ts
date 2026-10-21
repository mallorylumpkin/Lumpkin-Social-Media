import { generateJson } from "@/lib/ai/provider";
import { buildPrompt, composeCaption, FORMATS, parseDraft, PROMPT_VERSION, SYSTEM_PROMPT, templateDraft, trackingKey, type Draft, type Format, type ProductFacts } from "@/lib/content";
import { runReview } from "@/lib/review";

type Sb = any;

export async function getSetting<T>(supabase: Sb, orgId: string, key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

async function activeDisclosure(supabase: Sb, orgId: string, platform: string, retailerKeys: string[]) {
  const { data } = await supabase
    .from("disclosure_templates")
    .select("id, platform, program_key, body, status")
    .eq("org_id", orgId)
    .eq("status", "active")
    .is("deleted_at", null)
    .in("platform", [platform, "any"]);
  const rows: any[] = data ?? [];
  const primary = rows.find((r) => r.platform === platform && !r.program_key);
  const programs = new Set(retailerKeys.map((k) => (k === "amazon" ? "amazon_associates" : k === "walmart" ? "walmart_creator" : k === "shopmy_merchant" ? "shopmy" : k)));
  const extras = rows.filter((r) => r.program_key && programs.has(r.program_key));
  const bodies = [primary?.body, ...extras.map((e) => e.body)].filter(Boolean) as string[];
  // Without a platform wording the extras alone are not enough: the review will flag it as unverified.
  const text = primary ? bodies.join(" ") : null;
  return { templateId: (primary?.id ?? null) as string | null, text };
}

export type GenerateArgs = {
  supabase: Sb; orgId: string; userId: string; format: Format; angle: string; mode: "ai" | "template";
  productIds: string[]; facts: Record<string, string>;
  /** Regenerating: add a new version to this idea and retire the old one. */
  regenerateOf?: { versionId: string; ideaId: string; versionNo: number };
};

export async function createPackage(a: GenerateArgs): Promise<{ versionId: string } | { error: string }> {
  const { supabase, orgId, format } = a;
  const f = FORMATS[format];
  if (!f) return { error: "Unknown format." };
  if (f.multi ? a.productIds.length < 2 || a.productIds.length > 5 : a.productIds.length !== 1)
    return { error: f.multi ? "Pick 2 to 5 products for a multi-product post." : "Pick exactly one product for this format." };

  const { data: prods } = await supabase
    .from("products")
    .select("id, canonical_title, category, retailer_offers(deleted_at, retailers(key, name))")
    .eq("org_id", orgId)
    .in("id", a.productIds)
    .is("deleted_at", null);
  if (!prods || prods.length !== a.productIds.length) return { error: "Could not load the selected products." };
  const ordered = a.productIds.map((id) => prods.find((p: any) => p.id === id)!);

  const pf: ProductFacts[] = ordered.map((p: any) => {
    const off = (p.retailer_offers ?? []).find((o: any) => !o.deleted_at);
    return { title: p.canonical_title, category: p.category, retailer: off?.retailers?.name ?? "retailer", facts: (a.facts[p.id] ?? "").trim().slice(0, 600) };
  });
  const retailerKeys = ordered.map((p: any) => (p.retailer_offers ?? []).find((o: any) => !o.deleted_at)?.retailers?.key).filter(Boolean);

  let draft: Draft | null = null;
  let modelRef = "template";
  if (a.mode === "ai") {
    const provider = await getSetting<string>(supabase, orgId, "ai.provider", "gemini");
    const model = process.env.AI_MODEL || (await getSetting<string>(supabase, orgId, "ai.model", "gemini-2.5-flash"));
    const cap = Number(await getSetting<number>(supabase, orgId, "ai.daily_request_cap", 40));
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since.toISOString());
    if ((count ?? 0) >= cap) return { error: `Daily AI limit reached (${cap} calls). Use 'Quick draft (no AI)' or raise ai.daily_request_cap in Settings.` };

    const res = await generateJson({ provider, model, system: SYSTEM_PROMPT, prompt: buildPrompt(format, a.angle, pf) });
    await supabase.from("ai_usage").insert({
      org_id: orgId, provider, model: res.model, purpose: "content", ok: res.ok, tokens_in: res.ok ? res.tokensIn : null, tokens_out: res.ok ? res.tokensOut : null,
      cost_usd: 0, error: res.ok ? null : res.error, created_by: a.userId
    });
    if (!res.ok) return { error: res.error };
    draft = parseDraft(res.json);
    if (!draft) return { error: "The AI reply could not be used. Try again or use 'Quick draft (no AI)'." };
    modelRef = `${provider}:${res.model}`;
  } else {
    draft = templateDraft(format, pf);
  }

  const disc = await activeDisclosure(supabase, orgId, f.platform, retailerKeys as string[]);
  const caption = composeCaption(f.platform, disc.text, draft);
  const hook = f.platform === "pinterest" ? draft.pinTitle || draft.hook : draft.hook;
  const claims = pf.filter((p) => p.facts).map((p) => ({ claim: p.facts, product: p.title, source: "facts you typed from the listing", verified: true }));

  let ideaId = a.regenerateOf?.ideaId;
  if (!ideaId) {
    const title = pf.length > 1 ? `${pf[0].title} + ${pf.length - 1} more` : pf[0].title;
    const { data: idea, error } = await supabase
      .from("content_ideas")
      .insert({ org_id: orgId, title: title.slice(0, 200), angle: a.angle, format_hint: f.contentType, target_platform: f.platform, expected_role: "revenue", hooks: draft.hooks, status: "ready" })
      .select("id")
      .single();
    if (error || !idea) return { error: error?.message ?? "Could not save the idea." };
    ideaId = idea.id as string;
    const { error: lErr } = await supabase.from("content_idea_products").insert(a.productIds.map((pid, i) => ({ idea_id: ideaId, product_id: pid, org_id: orgId, position: i })));
    if (lErr) return { error: lErr.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("content_versions")
    .insert({
      org_id: orgId, idea_id: ideaId, version_no: (a.regenerateOf?.versionNo ?? 0) + 1, parent_version_id: a.regenerateOf?.versionId ?? null,
      platform: f.platform, content_type: f.contentType, status: "in_review", hook, script: draft.script || null, shot_list: draft.shotList,
      voiceover: draft.voiceover || null, on_screen_text: draft.onScreenText, caption, cta: draft.cta || null, disclosure_template_id: disc.templateId,
      disclosure_text: disc.text, discovery_terms: draft.discoveryTerms, claim_sources: claims, generated_by: "agent", prompt_version: PROMPT_VERSION,
      model_ref: modelRef, tracking_key: trackingKey(f.platform)
    })
    .select("id")
    .single();
  if (vErr || !ver) return { error: vErr?.message ?? "Could not save the package." };

  if (a.regenerateOf) await supabase.from("content_versions").update({ status: "superseded" }).eq("id", a.regenerateOf.versionId).eq("org_id", orgId);
  await runReview(supabase, orgId, ver.id);
  return { versionId: ver.id as string };
}
