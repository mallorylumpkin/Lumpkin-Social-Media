import Link from "next/link";
import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { ANGLES, FORMATS } from "@/lib/content";
import { generatePackage } from "./actions";

export default async function ContentStudioPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const [{ data: products }, { data: tpls }, { count: used }] = await Promise.all([
    supabase.from("products").select("id, canonical_title, category, is_synthetic, retailer_offers(deleted_at, retailers(name), affiliate_links(id, status, deleted_at))").eq("org_id", orgId).eq("status", "approved").is("deleted_at", null).order("created_at", { ascending: false }).limit(60),
    supabase.from("disclosure_templates").select("platform").eq("org_id", orgId).eq("status", "active").is("deleted_at", null),
    supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since.toISOString())
  ]);
  const active = new Set((tpls ?? []).map((t: any) => t.platform));
  const missing = ["instagram", "tiktok", "pinterest"].filter((p) => !active.has(p));

  return (
    <>
      <h1>Content Studio</h1>
      <p className="muted">Pick approved products, choose a format, and get a faceless, ready-to-review package. Nothing posts until you approve it.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      {missing.length > 0 && (
        <div className="flash err">
          No active disclosure for: {missing.join(", ")}. Packages for those platforms will be blocked until you <Link href="/compliance">activate the wording</Link>.
        </div>
      )}

      {(products ?? []).length === 0 ? (
        <div className="card">
          <p>No approved products yet. Add a product, score it, and tap <strong>Approve</strong> in the <Link href="/inbox">Research Inbox</Link>.</p>
        </div>
      ) : (
        <form action={generatePackage}>
          <div className="card">
            <h2>1. Products</h2>
            <p className="muted small">Single-product formats need exactly one. The multi-product post needs 2 to 5. Paste 2 to 4 facts from the listing so the content never makes things up.</p>
            {(products as any[]).map((p) => {
              const offer = (p.retailer_offers ?? []).find((o: any) => !o.deleted_at);
              const hasLink = (offer?.affiliate_links ?? []).some((l: any) => !l.deleted_at && l.status === "active");
              return (
                <div key={p.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                  <label className="check" style={{ marginTop: 0 }}>
                    <input type="checkbox" name="product_id" value={p.id} /> {p.canonical_title}
                    {p.is_synthetic && <span className="badge warn">test data</span>}
                    {!hasLink && <span className="badge bad">no affiliate link</span>}
                  </label>
                  <div className="muted small">{p.category ?? "no category"} · {offer?.retailers?.name ?? "retailer"}</div>
                  <textarea name={`facts_${p.id}`} placeholder="Facts from the listing, one per line (e.g. Fits a standard lunch bag. Dishwasher safe.)" style={{ minHeight: 64 }} />
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2>2. Format and angle</h2>
            <label htmlFor="format">Format</label>
            <select id="format" name="format" defaultValue="tiktok">
              {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <label htmlFor="angle">Angle</label>
            <select id="angle" name="angle" defaultValue="problem_solution">
              {Object.entries(ANGLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="actions">
              <button className="primary" type="submit" name="mode" value="ai">Generate with AI (free)</button>
              <button type="submit" name="mode" value="template">Quick draft (no AI)</button>
            </div>
            <p className="muted small">AI calls today: {used ?? 0}. Uses Google&apos;s free Gemini tier, so there is no cost. Only product names and the facts you type are sent: never personal details.</p>
          </div>
        </form>
      )}
    </>
  );
}
