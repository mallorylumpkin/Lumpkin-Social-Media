import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { Flash, pick } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { requireOrg } from "@/lib/org";
import { loadPackage } from "@/lib/review";
import { cancelItem, markPosted } from "./actions";

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const { data: items } = await supabase
    .from("content_calendar_items")
    .select("id, content_version_id, scheduled_for, status, social_accounts(handle, platform)")
    .eq("org_id", orgId)
    .in("status", ["manual_pending", "scheduled", "published"])
    .order("scheduled_for", { ascending: true })
    .limit(40);

  const open = (items ?? []).filter((i: any) => i.status !== "published");
  const done = (items ?? []).filter((i: any) => i.status === "published").reverse().slice(0, 10);
  const pkgs = await Promise.all(open.map((i: any) => loadPackage(supabase, orgId, i.content_version_id)));

  return (
    <>
      <h1>Calendar</h1>
      <p className="muted">
        Each card is a finished, approved package. At the scheduled time, copy it into the app, post it, then tap <strong>Mark posted</strong>.
        Fully automatic posting needs each platform&apos;s API access (Instagram needs a connected Facebook Page; TikTok and Pinterest need app review), so this is the manual-assist route until those are ready.
      </p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      {open.length === 0 && <div className="card muted">Nothing scheduled. Approve a package in the <Link href="/approvals">Approval Queue</Link> and schedule it.</div>}
      {open.map((i: any, idx: number) => {
        const pkg = pkgs[idx];
        const v = pkg?.version;
        return (
          <div className="card" key={i.id}>
            <div className="row between">
              <strong><LocalTime iso={i.scheduled_for} /></strong>
              <span className="badge accent">{i.social_accounts?.platform} · @{i.social_accounts?.handle}</span>
            </div>
            {v && (
              <>
                {v.hook && <p style={{ margin: "10px 0 4px", fontWeight: 600 }}>{v.hook}</p>}
                <pre className="json" style={{ background: "var(--bg)", padding: 10, borderRadius: 10 }}>{v.caption}</pre>
                <div className="actions"><CopyButton text={v.caption ?? ""} label="Copy caption" /></div>
                {pkg!.products.map((p: { id: string; title: string; retailerName: string; link: string | null }) => (
                  <div key={p.id} style={{ marginTop: 10 }}>
                    <div className="small"><strong>{p.title}</strong> ({p.retailerName}) link for this channel:</div>
                    {p.link ? (
                      <div className="row"><code style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>{p.link}</code><CopyButton text={p.link} label="Copy link" /></div>
                    ) : <span className="badge bad">no affiliate link saved</span>}
                  </div>
                ))}
                <details style={{ marginTop: 10 }}>
                  <summary>Shots, text and voiceover</summary>
                  {v.voiceover && <p><strong>Voiceover:</strong> {v.voiceover}</p>}
                  {(v.shot_list ?? []).length > 0 && <ol>{(v.shot_list as string[]).map((x, k) => <li key={k}>{x}</li>)}</ol>}
                  {(v.on_screen_text ?? []).length > 0 && <><strong>On-screen text</strong><ol>{(v.on_screen_text as string[]).map((x, k) => <li key={k}>{x}</li>)}</ol></>}
                </details>
                {v.platform === "instagram" && <p className="muted small">Stories: add the link with a Link sticker. Posts: put the link in your bio or storefront, since captions aren&apos;t clickable.</p>}
              </>
            )}
            <form action={markPosted} className="actions" style={{ alignItems: "end" }}>
              <input type="hidden" name="id" value={i.id} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <label htmlFor={`pl_${i.id}`}>Post link (optional)</label>
                <input id={`pl_${i.id}`} type="url" name="permalink" placeholder="https://…" />
              </div>
              <button className="primary" type="submit">Mark posted</button>
              <button type="submit" formAction={cancelItem} className="danger">Remove</button>
            </form>
          </div>
        );
      })}

      {done.length > 0 && (
        <>
          <h2>Recently posted</h2>
          <div className="card table-wrap">
            <table>
              <tbody>{done.map((i: any) => <tr key={i.id}><td><LocalTime iso={i.scheduled_for} /></td><td>{i.social_accounts?.platform} @{i.social_accounts?.handle}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
