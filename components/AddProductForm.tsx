"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProduct } from "@/app/(app)/products/actions";
import { uploadProductImages } from "@/lib/upload-product-images";

/** Adds a product and uploads its photos in one step. */
export function AddProductForm({ orgId, apiOn }: { orgId: string; apiOn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rights, setRights] = useState(false);
  const [cut, setCut] = useState(true);
  const [source, setSource] = useState("owner_provided");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length && !rights) {
      setMsg("Tick the box confirming you have the right to use the photos, or remove them.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("no_redirect", "1");
      // On a problem (missing name, link without a tracking ID, duplicate) the app shows the message on this page again.
      const res = await addProduct(fd);
      if (res && "productId" in res) {
        let note = "";
        if (files.length) {
          try {
            const r = await uploadProductImages({ orgId, productId: res.productId, files, source, cut });
            note = ` ${r.uploaded} photo${r.uploaded === 1 ? "" : "s"} added.`;
          } catch (err: any) {
            note = ` The product was added, but the photos failed: ${err?.message ?? "upload error"}. Add them on Product Images.`;
          }
        }
        router.push(`/inbox?msg=${encodeURIComponent("Added to your research inbox." + note)}`);
      }
    } catch (err: any) {
      // Redirects from the server action are handled by Next; anything else shows here.
      if (!String(err?.message ?? "").includes("NEXT_REDIRECT")) setMsg(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <label htmlFor="url">Product page URL *</label>
      <input id="url" name="url" type="url" placeholder="https://www.amazon.com/dp/..." required />

      <label htmlFor="title">Product name{apiOn ? " (optional for Amazon)" : " *"}</label>
      <input id="title" name="title" type="text" required={!apiOn} />

      <div className="grid" style={{ marginBottom: 0 }}>
        <div>
          <label htmlFor="price">Price (USD)</label>
          <input id="price" name="price" type="text" inputMode="decimal" placeholder="24.99" />
        </div>
        <div>
          <label htmlFor="rating">Star rating (0-5)</label>
          <input id="rating" name="rating" type="text" inputMode="decimal" placeholder="4.6" />
        </div>
        <div>
          <label htmlFor="reviews">Review count</label>
          <input id="reviews" name="reviews" type="text" inputMode="numeric" placeholder="3200" />
        </div>
      </div>

      <label htmlFor="retailer">Retailer (auto-detected from the link)</label>
      <select id="retailer" name="retailer" defaultValue="">
        <option value="">Detect automatically</option>
        <option value="amazon">Amazon</option>
        <option value="walmart">Walmart</option>
        <option value="shopmy_merchant">Other merchant / ShopMy</option>
      </select>

      <label htmlFor="category">Category</label>
      <input id="category" name="category" type="text" placeholder="Gifts for moms, Kitchen, Kids..." />

      <label htmlFor="affiliate_link">Your affiliate link {apiOn ? "(optional for Amazon)" : "(optional)"}</label>
      <input id="affiliate_link" name="affiliate_link" type="url" placeholder="Paste the link generated in your own affiliate account" />
      <p className="muted small">Amazon links must contain your tracking ID (tag=). The link is stored exactly as you paste it.</p>

      <label htmlFor="notes">Your notes (your own words)</label>
      <textarea id="notes" name="notes" style={{ fontFamily: "inherit", fontSize: "1rem" }} />

      <h3 style={{ marginBottom: 0 }}>Photos (optional)</h3>
      <p className="muted small" style={{ marginTop: 4 }}>Add your own photos or screenshots now, so the product is ready for collages. You can also add them later on Product Images.</p>
      <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} aria-label="Product photos" />
      {files.length > 0 && (
        <>
          <p className="small">{files.length} photo{files.length === 1 ? "" : "s"} selected.</p>
          <label htmlFor="src">Where did the photos come from?</label>
          <select id="src" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="owner_provided">My own photo or screenshot I made</option>
            <option value="retailer_permitted">From my affiliate program&apos;s own tools (allowed for my use)</option>
            <option value="official_product_media">Brand or press media I have permission to use</option>
          </select>
          <label className="check"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> I have the right to use these photos in my posts</label>
          <label className="check"><input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} /> Remove a plain white or solid background</label>
        </>
      )}

      <label className="check">
        <input type="checkbox" name="force" /> Add anyway if a similar product exists
      </label>

      {msg && <div className="flash err" style={{ marginTop: 12 }}>{msg}</div>}
      <div className="actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add to research inbox"}</button>
      </div>
    </form>
  );
}
