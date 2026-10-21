import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { saveEdit } from "../actions";

export default async function EditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const { data: v } = await supabase.from("content_versions").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!v) notFound();

  return (
    <>
      <h1>Edit package</h1>
      <p className="muted">{v.platform} · {String(v.content_type).replace("_", " ")}. Saving re-runs the rules check and returns it to the queue for approval. Keep the disclosure at the start of the caption.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      <form action={saveEdit} className="card">
        <input type="hidden" name="id" value={v.id} />
        <label htmlFor="hook">{v.platform === "pinterest" ? "Pin title" : "Hook"}</label>
        <input id="hook" type="text" name="hook" defaultValue={v.hook ?? ""} />
        <label htmlFor="caption">Caption (includes disclosure)</label>
        <textarea id="caption" name="caption" defaultValue={v.caption ?? ""} style={{ minHeight: 180 }} />
        <label htmlFor="cta">Call to action</label>
        <input id="cta" type="text" name="cta" defaultValue={v.cta ?? ""} />
        <label htmlFor="script">Script</label>
        <textarea id="script" name="script" defaultValue={v.script ?? ""} />
        <label htmlFor="voiceover">Voiceover</label>
        <textarea id="voiceover" name="voiceover" defaultValue={v.voiceover ?? ""} />
        <label htmlFor="shots">Shots (one per line)</label>
        <textarea id="shots" name="shot_list" defaultValue={(v.shot_list ?? []).join("\n")} />
        <label htmlFor="ost">On-screen text (one per line)</label>
        <textarea id="ost" name="on_screen_text" defaultValue={(v.on_screen_text ?? []).join("\n")} />
        <label htmlFor="terms">Hashtags / keywords</label>
        <input id="terms" type="text" name="discovery_terms" defaultValue={(v.discovery_terms ?? []).join(" ")} />
        <div className="actions">
          <button className="primary" type="submit">Save and re-check</button>
          <Link className="btn" href="/approvals">Cancel</Link>
        </div>
      </form>
    </>
  );
}
