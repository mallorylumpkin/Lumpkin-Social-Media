import Link from "next/link";
import { Flash, money, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { scoreProductAction, setProductStatus } from "../products/actions";

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, canonical_title, category, status, is_synthetic, source_url, retailer_offers(id, current_price, rating, review_count, retailers(name), affiliate_links(id, tracking_id)), product_opportunity_scores(id, total_score, confidence_level, recommended, reason_for, reason_against, missing_data, is_current, score_components(component_key, kind, points, missing, note))"
    )
    .eq("org_id", orgId)
    .in("status", ["candidate", "watching"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div className="row between">
        <div>
          <h1>Research Inbox</h1>
          <p className="muted">Candidates waiting for your decision. Score a product to see exactly why it is or is not recommended.</p>
        </div>
        <Link className="btn primary" href="/products/new">Add product</Link>
      </div>
      <Flash msg={pick(sp.msg)} error={pick(sp.error) ?? error?.message} />

      {(products ?? []).length === 0 && <div className="card muted">The inbox is empty. Add a product by pasting its link.</div>}

      {(products as any[] | null)?.map((p) => {
        const score = (p.product_opportunity_scores ?? []).find((s: any) => s.is_current);
        const offer = (p.retailer_offers ?? [])[0];
        return (
          <div className="card product" key={p.id}>
            <div className="row between">
              <div className="title">{p.canonical_title}</div>
              <span className="badge">{p.status}</span>
            </div>
            <div className="muted small">
              {p.category ?? "no category"}
              {p.is_synthetic && <> &middot; <span className="badge warn">synthetic test data, cannot be published</span></>}
            </div>
            <div className="small">
              {(p.retailer_offers ?? []).map((o: any) => (
                <span key={o.id} style={{ marginRight: 12 }}>
                  {o.retailers?.name}: {money(o.current_price)}
                  {o.rating ? ` · ${o.rating}★` : ""}
                  {o.review_count ? ` · ${o.review_count} reviews` : ""}
                  {o.affiliate_links?.length ? <span className="badge ok" style={{ marginLeft: 6 }}>link added</span> : <span className="badge warn" style={{ marginLeft: 6 }}>no affiliate link yet</span>}
                </span>
              ))}
              {!offer && <span className="muted">No retailer offer yet.</span>}
            </div>

            {score && (
              <details>
                <summary>
                  Score <strong>{score.total_score}</strong>/100 · {score.confidence_level} confidence{" "}
                  {score.recommended ? <span className="badge ok">recommended</span> : <span className="badge warn">not yet</span>}
                </summary>
                <p className="small">{score.reason_for}</p>
                <p className="small">{score.reason_against}</p>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Part</th><th>Points</th><th>Why</th></tr></thead>
                    <tbody>
                      {(score.score_components ?? []).map((c: any) => (
                        <tr key={c.kind + c.component_key}>
                          <td>{c.component_key.replace(/_/g, " ")} {c.kind === "penalty" && <span className="badge bad">penalty</span>}</td>
                          <td>{c.missing ? <span className="muted">missing</span> : c.points}</td>
                          <td className="small muted">{c.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="actions">
              <form action={scoreProductAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="back" value="/inbox" />
                <button type="submit">{score ? "Re-score" : "Score"}</button>
              </form>
              {[
                ["approved", "Approve", "primary"],
                ["watching", "Watch", ""],
                ["rejected", "Reject", "danger"]
              ].map(([status, label, cls]) => (
                <form action={setProductStatus} key={status}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="back" value="/inbox" />
                  <button className={cls} type="submit">{label}</button>
                </form>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
