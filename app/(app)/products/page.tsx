import Link from "next/link";
import { Flash, money, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";

const FILTERS = ["all", "candidate", "watching", "approved", "rejected", "paused", "retired"];

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const status = pick(sp.status) ?? "all";

  let q = supabase
    .from("products")
    .select(
      "id, canonical_title, category, status, is_synthetic, created_at, retailer_offers(id, current_price, rating, review_count, status, retailers(name)), product_opportunity_scores(total_score, confidence_level, is_current)"
    )
    .eq("org_id", orgId)
    .is("deleted_at", null);
  if (status !== "all") q = q.eq("status", status);
  const { data: products, error } = await q.order("created_at", { ascending: false }).limit(200);

  return (
    <>
      <div className="row between">
        <div>
          <h1>Products</h1>
          <p className="muted">Your catalog. One product can have offers at several retailers.</p>
        </div>
        <Link className="btn primary" href="/products/new">Add product</Link>
      </div>
      <Flash msg={pick(sp.msg)} error={pick(sp.error) ?? error?.message} />

      <div className="row" style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <Link key={f} className="btn" href={f === "all" ? "/products" : `/products?status=${f}`} style={f === status ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>
            {f}
          </Link>
        ))}
      </div>

      {(products ?? []).length === 0 ? (
        <div className="card muted">No products here yet.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>Offers</th><th>Score</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(products as any[]).map((p) => {
                const score = (p.product_opportunity_scores ?? []).find((s: any) => s.is_current);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="title">{p.canonical_title}</div>
                      <div className="muted small">
                        {p.category ?? "no category"} {p.is_synthetic && <span className="badge warn">synthetic test data</span>}
                      </div>
                    </td>
                    <td>
                      {(p.retailer_offers ?? []).map((o: any) => (
                        <div key={o.id} className="small">
                          {o.retailers?.name}: {money(o.current_price)}
                        </div>
                      ))}
                    </td>
                    <td>{score ? `${score.total_score} (${score.confidence_level})` : <span className="muted">not scored</span>}</td>
                    <td><span className="badge">{p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
