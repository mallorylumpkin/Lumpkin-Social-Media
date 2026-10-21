import Link from "next/link";
import { getContext } from "@/lib/org";
import { Flash, pick } from "@/components/Flash";

export default async function TodayPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await getContext();
  if (!orgId) {
    // The layout shows the onboarding form; surface any error from it.
    return <Flash error={pick(sp.error)} />;
  }

  const count = async (table: string, filter: (q: any) => any) => {
    const { count: c } = await filter(supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId));
    return c ?? 0;
  };

  const [candidates, approved, inReview, scheduled, draftDisclosures, brokenLinks, productsTotal] = await Promise.all([
    count("products", (q) => q.in("status", ["candidate", "watching"]).is("deleted_at", null)),
    count("products", (q) => q.eq("status", "approved").is("deleted_at", null)),
    count("content_versions", (q) => q.eq("status", "in_review").is("deleted_at", null)),
    count("content_calendar_items", (q) => q.in("status", ["scheduled", "manual_pending"])),
    count("disclosure_templates", (q) => q.eq("status", "draft").is("deleted_at", null)),
    count("affiliate_links", (q) => q.in("status", ["broken", "expired"]).is("deleted_at", null)),
    count("products", (q) => q.is("deleted_at", null))
  ]);

  const { data: social } = await supabase
    .from("social_accounts")
    .select("platform, handle, status")
    .eq("org_id", orgId)
    .is("deleted_at", null);
  const { data: aff } = await supabase
    .from("affiliate_accounts")
    .select("label, tracking_ids, affiliate_programs(key)")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  const todo: { text: string; href: string; tag?: string }[] = [];
  const unsetHandles = (social ?? []).filter((s: any) => s.status === "planned" || s.handle === "planned");
  if (unsetHandles.length)
    todo.push({ text: `Enter your handle for ${unsetHandles.map((s: any) => s.platform).join(", ")}`, href: "/integrations" });
  const amazon = (aff ?? []).find((a: any) => a.affiliate_programs?.key === "amazon_associates");
  const missingIds = ["instagram", "tiktok", "pinterest"].filter((p) => !(amazon?.tracking_ids as any)?.[p]);
  if (amazon && missingIds.length)
    todo.push({ text: `Add your Amazon tracking ID for ${missingIds.join(", ")}`, href: "/integrations" });
  if (draftDisclosures > 0)
    todo.push({ text: `Review and activate ${draftDisclosures} disclosure wordings (nothing can be scheduled until you do)`, href: "/compliance", tag: "required" });
  if (productsTotal === 0)
    todo.push({ text: "Add your first product (paste a product URL)", href: "/products/new" });
  if (inReview > 0) todo.push({ text: `${inReview} content packages waiting for your approval`, href: "/approvals", tag: "review" });
  if (approved > 0 && inReview === 0) todo.push({ text: `${approved} approved products: make content for them`, href: "/content" });
  if (scheduled > 0) todo.push({ text: `${scheduled} posts scheduled: post them and tap Mark posted`, href: "/calendar" });
  if (candidates > 0) todo.push({ text: `${candidates} products waiting in your Research Inbox`, href: "/inbox" });

  return (
    <>
      <h1>Today</h1>
      <p className="muted">What needs you, and how things stand.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      <div className="card">
        <h2>Your next actions</h2>
        {todo.length === 0 ? (
          <p className="muted">Nothing needs you right now.</p>
        ) : (
          <ul className="checklist">
            {todo.map((t) => (
              <li key={t.text}>
                <span>
                  {t.text} {t.tag && <span className="badge warn">{t.tag}</span>}
                </span>
                <Link className="btn" href={t.href}>Open</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid">
        <Link href="/inbox" className="stat" style={{ color: "inherit" }}>
          <div className="muted small">In research inbox</div>
          <div className="n">{candidates}</div>
        </Link>
        <Link href="/products?status=approved" className="stat" style={{ color: "inherit" }}>
          <div className="muted small">Approved products</div>
          <div className="n">{approved}</div>
        </Link>
        <Link href="/approvals" className="stat" style={{ color: "inherit" }}>
          <div className="muted small">Posts awaiting approval</div>
          <div className="n">{inReview}</div>
        </Link>
        <Link href="/calendar" className="stat" style={{ color: "inherit" }}>
          <div className="muted small">Scheduled posts</div>
          <div className="n">{scheduled}</div>
        </Link>
        <div className="stat">
          <div className="muted small">Broken or expired links</div>
          <div className="n">{brokenLinks}</div>
        </div>
      </div>

      <div className="card">
        <h2>Channels</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Platform</th><th>Handle</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(social ?? []).map((s: any) => (
                <tr key={s.platform + s.handle}>
                  <td style={{ textTransform: "capitalize" }}>{s.platform}</td>
                  <td>{s.handle === "planned" ? <span className="muted">not entered</span> : "@" + s.handle}</td>
                  <td><span className={`badge ${s.status === "active" ? "ok" : "warn"}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
