import { ImageUploader } from "@/components/ImageUploader";
import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { removeImage } from "./actions";

export default async function ImagesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const { data: products } = await supabase
    .from("products")
    .select("id, canonical_title, status, content_assets(id, storage_ref, source_type, deleted_at, asset_type)")
    .eq("org_id", orgId)
    .in("status", ["approved", "watching", "candidate"])
    .is("deleted_at", null)
    .order("status")
    .order("created_at", { ascending: false })
    .limit(60);

  // Short-lived links so the thumbnails can show from your private storage.
  const paths: string[] = [];
  for (const p of (products ?? []) as any[]) for (const a of p.content_assets ?? []) if (!a.deleted_at && a.asset_type === "image" && a.storage_ref) paths.push(a.storage_ref);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("product-images").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  return (
    <>
      <h1>Product Images</h1>
      <p className="muted">
        Upload the images the collages use. Use your own photos or screenshots, or images your affiliate program lets you use. The app never copies images from retailer websites.
        Photos with a plain or white background look best.
      </p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      {(products ?? []).length === 0 && <div className="card muted">Add and approve a product first.</div>}
      {((products ?? []) as any[]).map((p) => {
        const imgs = (p.content_assets ?? []).filter((a: any) => !a.deleted_at && a.asset_type === "image" && a.storage_ref);
        return (
          <div className="card" key={p.id}>
            <div className="row between">
              <strong>{p.canonical_title}</strong>
              <span className={`badge ${imgs.length ? "ok" : "warn"}`}>{imgs.length ? `${imgs.length} image${imgs.length > 1 ? "s" : ""}` : "no image"}</span>
            </div>
            {imgs.length > 0 && (
              <div className="row" style={{ alignItems: "flex-start", marginTop: 10 }}>
                {imgs.map((a: any) => (
                  <form action={removeImage} key={a.id} style={{ width: 96 }}>
                    <input type="hidden" name="id" value={a.id} />
                    {signed.get(a.storage_ref) ? <img src={signed.get(a.storage_ref)} alt="" style={{ width: 96, height: 96, objectFit: "contain", background: "#fff", border: "1px solid var(--line)", borderRadius: 8 }} /> : <div className="muted small">preview unavailable</div>}
                    <button type="submit" className="danger" style={{ minHeight: 32, padding: "4px 10px", marginTop: 4 }}>Remove</button>
                  </form>
                ))}
              </div>
            )}
            <ImageUploader orgId={orgId} productId={p.id} />
          </div>
        );
      })}
    </>
  );
}
