import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { addBoard, addSocialAccount, saveTrackingIds, updateSocialAccount } from "./actions";

const CHANNELS = ["instagram", "tiktok", "pinterest"] as const;

function statusClass(s: string) {
  if (s === "verified_supported") return "ok";
  if (s === "partly_verified") return "warn";
  if (s === "verified_unsupported") return "bad";
  return "";
}

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();

  const [{ data: social }, { data: affiliate }, { data: boards }, { data: programs }] = await Promise.all([
    supabase.from("social_accounts").select("id, platform, handle, status, account_type, publishing_method").eq("org_id", orgId).is("deleted_at", null).order("platform"),
    supabase.from("affiliate_accounts").select("id, label, status, tracking_ids, registered_channels, affiliate_programs(key, name, api_status, capabilities, notes)").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("social_destinations").select("id, name, kind, social_account_id").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("affiliate_programs").select("key, name, api_status, capabilities, notes").order("name")
  ]);

  return (
    <>
      <h1>Integrations</h1>
      <p className="muted">Connect accounts, store tracking IDs, and see what each platform can and cannot automate. Nothing here stores passwords.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      <div className="card">
        <h2>Social accounts</h2>
        {(social ?? []).map((s: any) => (
          <form action={updateSocialAccount} key={s.id} className="row" style={{ marginBottom: 10 }}>
            <input type="hidden" name="id" value={s.id} />
            <span style={{ width: 90, textTransform: "capitalize", fontWeight: 600 }}>{s.platform}</span>
            <input style={{ flex: 1, minWidth: 140 }} type="text" name="handle" defaultValue={s.handle === "planned" ? "" : s.handle} placeholder="handle without @" aria-label={`${s.platform} handle`} />
            <select name="status" defaultValue={s.status === "planned" && s.handle !== "planned" ? "active" : s.status} style={{ width: 130 }} aria-label="status">
              {["planned", "active", "paused", "disconnected", "error"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <span className="badge">{s.publishing_method}</span>
            <button type="submit">Save</button>
          </form>
        ))}
        <details>
          <summary>Add another account (new Instagram, TikTok, or Pinterest)</summary>
          <form action={addSocialAccount}>
            <label htmlFor="platform">Platform</label>
            <select id="platform" name="platform" defaultValue="instagram">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="pinterest">Pinterest</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
            <label htmlFor="handle">Handle (no @)</label>
            <input id="handle" name="handle" type="text" required />
            <label htmlFor="account_type">Account type</label>
            <select id="account_type" name="account_type" defaultValue="business">
              <option value="business">Business</option>
              <option value="creator">Creator</option>
              <option value="personal">Personal</option>
            </select>
            <div className="actions"><button className="primary" type="submit">Add account</button></div>
          </form>
        </details>
      </div>

      <div className="card">
        <h2>Pinterest boards</h2>
        {(boards ?? []).length === 0 && <p className="muted">No boards yet.</p>}
        <ul className="checklist">
          {(boards ?? []).map((b: any) => (
            <li key={b.id}><span>{b.name}</span><span className="badge">{b.kind}</span></li>
          ))}
        </ul>
        {(social ?? []).some((s: any) => s.platform === "pinterest") && (
          <form action={addBoard} className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="social_account_id" value={(social ?? []).find((s: any) => s.platform === "pinterest")?.id} />
            <input style={{ flex: 1, minWidth: 180 }} type="text" name="name" placeholder="New board name" aria-label="board name" />
            <button type="submit">Add board</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Affiliate accounts and tracking IDs</h2>
        <p className="muted small">Use a separate tracking ID per channel so reports show which platform earned what. Tick each channel only after you added it in that program&apos;s dashboard.</p>
        {(affiliate ?? []).map((a: any) => (
          <form action={saveTrackingIds} key={a.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <input type="hidden" name="id" value={a.id} />
            <div className="row between">
              <h3>{a.affiliate_programs?.name}</h3>
              <span className="badge ok">{a.status}</span>
            </div>
            <div className="grid" style={{ marginBottom: 0 }}>
              {CHANNELS.map((c) => (
                <div key={c}>
                  <label htmlFor={`tid_${a.id}_${c}`} style={{ textTransform: "capitalize" }}>{c} tracking ID</label>
                  <input id={`tid_${a.id}_${c}`} type="text" name={`tid_${c}`} defaultValue={(a.tracking_ids ?? {})[c] ?? ""} placeholder={a.affiliate_programs?.key === "amazon_associates" ? "yourname-20" : "optional"} />
                  <label className="check">
                    <input type="checkbox" name={`reg_${c}`} defaultChecked={(a.registered_channels ?? []).includes(c)} /> registered with program
                  </label>
                </div>
              ))}
            </div>
            <div className="actions"><button type="submit">Save</button></div>
          </form>
        ))}
      </div>

      <div className="card">
        <h2>What each platform can automate (verified status)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Program</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {(programs ?? []).map((p: any) => (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${statusClass(p.api_status)}`}>{p.api_status.replace(/_/g, " ")}</span></td>
                  <td className="small muted">{p.notes}<pre className="json">{JSON.stringify(p.capabilities)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Your Amazon account shows the Creators API with 2 application slots. It will be used in a later phase for automatic product data once eligibility is confirmed.
        </p>
      </div>
    </>
  );
}
