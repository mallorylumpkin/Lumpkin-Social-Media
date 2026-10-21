import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { saveDisclosure } from "./actions";

export default async function CompliancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const [{ data: templates }, { data: policies }] = await Promise.all([
    supabase.from("disclosure_templates").select("id, platform, program_key, name, body, status, verification_status, version").eq("org_id", orgId).is("deleted_at", null).order("platform"),
    supabase.from("platform_policies").select("platform, title, summary, verification_status").is("org_id", null).order("platform")
  ]);

  return (
    <>
      <h1>Compliance</h1>
      <p className="muted">
        Every post needs a disclosure before it can be scheduled. The wording below is a starting draft. Check it against each program&apos;s current
        rules (for Amazon, the Associates Operating Agreement), edit it, then tick the box to activate it. This is not legal advice.
      </p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      {(templates ?? []).map((t: any) => (
        <form action={saveDisclosure} className="card" key={t.id}>
          <input type="hidden" name="id" value={t.id} />
          <div className="row between">
            <h3 style={{ margin: 0 }}>{t.name}</h3>
            <span className={`badge ${t.status === "active" ? "ok" : "warn"}`}>{t.status} · v{t.version}</span>
          </div>
          <label htmlFor={`b_${t.id}`}>Wording ({t.platform}{t.program_key ? `, ${t.program_key}` : ""})</label>
          <textarea id={`b_${t.id}`} name="body" defaultValue={t.body} style={{ fontFamily: "inherit", fontSize: "1rem" }} />
          <label className="check">
            <input type="checkbox" name="verified" defaultChecked={t.status === "active"} /> I checked this wording against the current program and platform rules
          </label>
          <div className="actions"><button className="primary" type="submit">Save</button></div>
        </form>
      ))}

      <div className="card">
        <h2>Platform and program notes</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Source</th><th>Rule</th><th>Status</th></tr></thead>
            <tbody>
              {(policies ?? []).map((p: any) => (
                <tr key={p.platform + p.title}>
                  <td style={{ textTransform: "capitalize" }}>{p.platform.replace(/_/g, " ")}</td>
                  <td><strong>{p.title}</strong><div className="small muted">{p.summary}</div></td>
                  <td><span className="badge warn">{p.verification_status.replace(/_/g, " ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
