import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { seedSynthetic, setAutomation, updateSetting } from "./actions";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const [{ data: org }, { data: settings }] = await Promise.all([
    supabase.from("organizations").select("automation_paused, automation_mode, child_content_allowed").eq("id", orgId).single(),
    supabase.from("settings").select("key, value, is_default, description, version").eq("org_id", orgId).order("key")
  ]);

  return (
    <>
      <h1>Settings</h1>
      <p className="muted">Every rule is editable. &quot;Default&quot; means I picked it until you decide; edited values become &quot;owner set&quot;.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      <form action={setAutomation} className="card">
        <h2>Automation</h2>
        <label htmlFor="mode">Mode</label>
        <select id="mode" name="mode" defaultValue={org?.automation_mode}>
          <option value="draft_only">1. Draft only</option>
          <option value="recommend_approve">2. Recommend and await my approval (every post needs approval)</option>
          <option value="auto_schedule">3. Auto-schedule approved templates and categories</option>
          <option value="auto_publish">4. Auto-publish within guardrails</option>
        </select>
        <label className="check">
          <input type="checkbox" name="paused" defaultChecked={org?.automation_paused} /> Pause ALL automation (nothing publishes through the API while this is on)
        </label>
        <p className="muted small">
          Child content: <strong>{org?.child_content_allowed ? "allowed" : "prohibited"}</strong>. Products made for children and pictures of those products are fine; people who are children are not shown.
        </p>
        <div className="actions"><button className="primary" type="submit">Save</button></div>
      </form>

      <div className="card">
        <h2>Rules and thresholds</h2>
        {(settings ?? []).map((s: any) => (
          <form action={updateSetting} key={s.key} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
            <input type="hidden" name="key" value={s.key} />
            <div className="row between">
              <strong>{s.key}</strong>
              <span className={`badge ${s.is_default ? "warn" : "ok"}`}>{s.is_default ? "default" : "owner set"}</span>
            </div>
            <div className="muted small">{s.description}</div>
            <div className="row" style={{ marginTop: 6 }}>
              <input style={{ flex: 1, minWidth: 180 }} type="text" name="value" defaultValue={JSON.stringify(s.value)} aria-label={s.key} />
              <button type="submit">Save</button>
            </div>
          </form>
        ))}
      </div>

      <div className="card">
        <h2>Test data</h2>
        <p className="muted small">Adds five clearly labeled synthetic products so you can try scoring and approvals. They use fake links and can never be published.</p>
        <form action={seedSynthetic}><button type="submit">Add synthetic test products</button></form>
      </div>
    </>
  );
}
