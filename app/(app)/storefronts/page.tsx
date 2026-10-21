import { requireOrg } from "@/lib/org";

export default async function StorefrontsPage() {
  const { supabase, orgId } = await requireOrg();
  const { data: storefronts } = await supabase
    .from("storefronts")
    .select("id, name, integration_mode, storefront_collections(id, name, position, status, storefront_collection_products(status))")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  return (
    <>
      <h1>Storefronts</h1>
      <p className="muted">
        Collections are named under your brand. Until an official integration is confirmed for each platform, changes go through a queue:
        you approve a product here, then add it in the platform with one copy-and-paste.
      </p>
      {(storefronts as any[] | null)?.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <h2>{s.name}</h2>
            <span className="badge warn">{s.integration_mode} mode</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Collection</th><th>Live</th><th>Waiting</th></tr></thead>
              <tbody>
                {[...(s.storefront_collections ?? [])].sort((a: any, b: any) => a.position - b.position).map((c: any) => {
                  const rows = c.storefront_collection_products ?? [];
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{rows.filter((r: any) => r.status === "live").length}</td>
                      <td>{rows.filter((r: any) => r.status === "proposed" || r.status === "approved").length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
