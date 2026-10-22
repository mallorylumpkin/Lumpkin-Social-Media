import Link from "next/link";
import { Flash, money, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { creatorsConfigured, partnerTag, PRICE_DISCLAIMER, searchItems } from "@/lib/amazon-creators";
import { addSuggested } from "./actions";

const SORTS: Record<string, string> = { Relevance: "Most relevant", Featured: "Featured", AvgCustomerReviews: "Best reviewed", NewestArrivals: "Newest" };

export default async function DiscoverPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const q = (pick(sp.q) ?? "").trim();
  const sort = pick(sp.sort) && SORTS[pick(sp.sort)!] ? pick(sp.sort)! : "Relevance";
  const configured = creatorsConfigured();
  const tag = configured ? await partnerTag(supabase, orgId) : null;

  let results: Awaited<ReturnType<typeof searchItems>> | null = null;
  if (configured && tag && q) results = await searchItems({ keywords: q, partnerTag: tag, sortBy: sort, minPrice: 1, count: 10 });

  return (
    <>
      <h1>Discover</h1>
      <p className="muted">Search Amazon for product ideas, see price and sales rank, and add the good ones to your Research Inbox. Sales rank is Amazon&apos;s own popularity ranking: a lower number means it sells more. Nothing here guarantees a product will convert.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error) ?? (results && !results.ok ? results.error : undefined)} />

      {!configured && (
        <div className="card">
          <p><strong>Amazon Creators API is not connected yet.</strong> Add <code>AMAZON_CREATORS_CLIENT_ID</code> and <code>AMAZON_CREATORS_CLIENT_SECRET</code> in Netlify (mark them secret), then redeploy.</p>
        </div>
      )}
      {configured && !tag && <div className="card"><p>Save an Amazon tracking ID on the <Link href="/integrations">Integrations</Link> page so searches can run.</p></div>}

      <form method="get" className="card">
        <label htmlFor="q">What are you looking for?</label>
        <input id="q" name="q" type="text" defaultValue={q} placeholder="e.g. lunch box for kids, mother's day gifts, cozy blanket" required />
        <label htmlFor="sort">Order by</label>
        <select id="sort" name="sort" defaultValue={sort}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div className="actions"><button className="primary" type="submit" disabled={!configured || !tag}>Search Amazon</button></div>
      </form>

      {results && results.ok && (
        <>
          {results.data.length === 0 && <div className="card muted">No results. Try different words.</div>}
          {[...results.data].sort((a, b) => (a.salesRank ?? 9e12) - (b.salesRank ?? 9e12)).map((it) => (
            <form action={addSuggested} className="card" key={it.asin}>
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="asin" value={it.asin} />
              <input type="hidden" name="title" value={it.title ?? ""} />
              <input type="hidden" name="price" value={it.price ?? ""} />
              <input type="hidden" name="availability" value={it.availability} />
              <input type="hidden" name="tag" value={tag ?? ""} />
              <div className="row between">
                <strong>{it.title ?? it.asin}</strong>
                <span className="badge">{it.salesRank ? `sales rank #${it.salesRank.toLocaleString()}` : "no sales rank"}</span>
              </div>
              <div className="small muted">{money(it.price)} · {it.availability.replace("_", " ")} · as of {new Date(results.fetchedAt).toUTCString()}</div>
              {it.features.length > 0 && <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{it.features.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}</ul>}
              <div className="actions">
                <a className="btn" href={`https://www.amazon.com/dp/${it.asin}`} target="_blank" rel="noreferrer">View on Amazon</a>
                <button className="primary" type="submit" disabled={!it.title}>Add to Research Inbox</button>
              </div>
            </form>
          ))}
          <p className="muted small">{PRICE_DISCLAIMER}</p>
        </>
      )}
    </>
  );
}
