import Link from "next/link";
import { Flash, pick } from "@/components/Flash";
import { LocalDateTime } from "@/components/LocalTime";
import { requireOrg } from "@/lib/org";
import { slotKey, STARTER_SLOTS } from "@/lib/scheduling";
import { approveVersion, batchApprove, regenerateVersion, rejectVersion, scheduleVersion } from "./actions";

const sevClass: Record<string, string> = { block: "bad", warn: "warn", info: "" };

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId, role } = await requireOrg();
  const [{ data: versions }, { data: accounts }] = await Promise.all([
    supabase
      .from("content_versions")
      .select("id, platform, content_type, status, hook, caption, script, voiceover, shot_list, on_screen_text, cta, version_no, model_ref, created_at, content_ideas(title, content_idea_products(products(canonical_title))), compliance_reviews(result, findings, created_at), content_calendar_items(id, status)")
      .eq("org_id", orgId)
      .in("status", ["in_review", "approved"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("social_accounts").select("id, platform, handle, status").eq("org_id", orgId).eq("status", "active")
  ]);

  const rows = ((versions ?? []) as any[]).map((v) => {
    const latest = [...(v.compliance_reviews ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    const scheduled = (v.content_calendar_items ?? []).some((c: any) => !["cancelled", "failed"].includes(c.status));
    return { ...v, latest, scheduled };
  });
  const pending = rows.filter((r) => r.status === "in_review");
  const approved = rows.filter((r) => r.status === "approved" && !r.scheduled);
  const clean = pending.filter((r) => r.latest?.result === "pass");

  return (
    <>
      <h1>Approval Queue</h1>
      <p className="muted">Review each package, fix anything flagged, approve, then schedule. Nothing leaves this app without your approval.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      {clean.length > 1 && (
        <form action={batchApprove} className="card">
          {clean.map((c) => <input key={c.id} type="hidden" name="id" value={c.id} />)}
          <div className="row between">
            <span><strong>{clean.length}</strong> packages passed every check with no warnings.</span>
            <button className="primary" type="submit">Approve all {clean.length}</button>
          </div>
        </form>
      )}

      <h2>Needs your review ({pending.length})</h2>
      {pending.length === 0 && <div className="card muted">Nothing waiting. Make more in the <Link href="/content">Content Studio</Link>.</div>}
      {pending.map((v) => {
        const blocked = v.latest?.result === "block";
        const names = (v.content_ideas?.content_idea_products ?? []).map((x: any) => x.products?.canonical_title).filter(Boolean).join(", ");
        return (
          <div className="card" key={v.id}>
            <div className="row between">
              <strong>{names || v.content_ideas?.title}</strong>
              <span className="row">
                <span className="badge accent">{v.platform} · {v.content_type.replace("_", " ")}</span>
                <span className={`badge ${blocked ? "bad" : v.latest?.result === "warn" ? "warn" : "ok"}`}>{blocked ? "blocked" : v.latest?.result === "warn" ? "warnings" : "all checks passed"}</span>
              </span>
            </div>
            {v.hook && <p style={{ margin: "10px 0 4px", fontWeight: 600 }}>{v.hook}</p>}
            <pre className="json" style={{ background: "var(--bg)", padding: 10, borderRadius: 10 }}>{v.caption}</pre>
            <details style={{ marginTop: 8 }}>
              <summary>Script, shots and on-screen text</summary>
              {v.script && <p><strong>Script:</strong> {v.script}</p>}
              {v.voiceover && <p><strong>Voiceover:</strong> {v.voiceover}</p>}
              {(v.shot_list ?? []).length > 0 && <><strong>Shots</strong><ol>{(v.shot_list as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol></>}
              {(v.on_screen_text ?? []).length > 0 && <><strong>On-screen text</strong><ol>{(v.on_screen_text as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol></>}
              <p className="muted small">Made by {v.model_ref === "template" ? "quick template" : v.model_ref} · version {v.version_no}</p>
            </details>
            {(v.latest?.findings ?? []).length > 0 && (
              <ul style={{ paddingLeft: 18, margin: "10px 0 0" }}>
                {(v.latest.findings as any[]).map((f, i) => (
                  <li key={i} className="small"><span className={`badge ${sevClass[f.severity]}`}>{f.severity}</span> {f.detail}</li>
                ))}
              </ul>
            )}
            <div className="actions">
              <form action={approveVersion}><input type="hidden" name="id" value={v.id} /><button className="primary" type="submit" disabled={blocked}>Approve</button></form>
              <Link className="btn" href={`/approvals/${v.id}`}>Edit</Link>
              <form action={regenerateVersion}><input type="hidden" name="id" value={v.id} /><button type="submit" name="mode" value="ai">Regenerate (AI)</button></form>
              <form action={rejectVersion}><input type="hidden" name="id" value={v.id} /><button className="danger" type="submit">Reject</button></form>
            </div>
          </div>
        );
      })}

      <h2>Approved, ready to schedule ({approved.length})</h2>
      {approved.length === 0 && <div className="card muted">Approved packages that are not scheduled yet show up here.</div>}
      {approved.map((v) => {
        const accts = (accounts ?? []).filter((a: any) => a.platform === v.platform);
        const names = (v.content_ideas?.content_idea_products ?? []).map((x: any) => x.products?.canonical_title).filter(Boolean).join(", ");
        return (
          <form action={scheduleVersion} className="card" key={v.id}>
            <input type="hidden" name="id" value={v.id} />
            <div className="row between"><strong>{names || v.content_ideas?.title}</strong><span className="badge ok">approved · {v.platform}</span></div>
            {accts.length === 0 ? (
              <p className="muted small">No active {v.platform} account. Add the handle on <Link href="/integrations">Integrations</Link>.</p>
            ) : (
              <>
                <label>Account</label>
                <select name="account_id" defaultValue={accts[0].id}>{accts.map((a: any) => <option key={a.id} value={a.id}>@{a.handle}</option>)}</select>
                <label>When (your time zone)</label>
                <LocalDateTime slots={STARTER_SLOTS[slotKey(v.platform, v.content_type)] ?? [12]} />
                <p className="muted small">Starting suggestion only, not measured yet. It improves once your analytics are imported.</p>
                <div className="actions"><button className="primary" type="submit">Schedule</button></div>
              </>
            )}
          </form>
        );
      })}
      {role === "viewer" && <p className="muted small">You have view-only access.</p>}
    </>
  );
}
