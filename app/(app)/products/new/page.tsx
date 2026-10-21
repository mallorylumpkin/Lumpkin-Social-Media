import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { addProduct } from "../actions";

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  await requireOrg();
  return (
    <>
      <h1>Add a product</h1>
      <p className="muted">
        Paste the product page link. The app reads only the link you paste; it does not open or scrape the page, so type in the price and
        ratings you see. Anything you leave blank is stored as unavailable, never as zero.
      </p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      <form action={addProduct} className="card">
        <label htmlFor="url">Product page URL *</label>
        <input id="url" name="url" type="url" placeholder="https://www.amazon.com/dp/..." required />

        <label htmlFor="title">Product name *</label>
        <input id="title" name="title" type="text" required />

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

        <label htmlFor="affiliate_link">Your affiliate link (optional)</label>
        <input id="affiliate_link" name="affiliate_link" type="url" placeholder="Paste the link generated in your own affiliate account" />
        <p className="muted small">Amazon links must contain your tracking ID (tag=). The link is stored exactly as you paste it.</p>

        <label htmlFor="notes">Your notes (your own words)</label>
        <textarea id="notes" name="notes" style={{ fontFamily: "inherit", fontSize: "1rem" }} />

        <label className="check">
          <input type="checkbox" name="force" /> Add anyway if a similar product exists
        </label>

        <div className="actions">
          <button className="primary" type="submit">Add to research inbox</button>
        </div>
      </form>
    </>
  );
}
