import Link from "next/link";
import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { weekKey } from "@/lib/collage";
import { DEFAULT_STYLE, normalizeStyle, TITLE_PRESETS } from "@/lib/collage-style";
import { getSetting } from "@/lib/generate";
import { StyleFields } from "@/components/StyleFields";
import { CollageImporter } from "@/components/CollageImporter";
import { makeCollage, makeWeeklyNow, saveDefaultStyle } from "./actions";

export default async function CollagesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const [{ data: products }, { data: thisWeek }] = await Promise.all([
    supabase.from("products").select("id, canonical_title, is_synthetic, content_assets(id, deleted_at, asset_type, storage_ref)").eq("org_id", orgId).eq("status", "approved").is("deleted_at", null).order("created_at", { ascending: false }).limit(80),
    supabase.from("content_versions").select("id, platform, status").eq("org_id", orgId).like("tracking_key", `mlk-collage-${weekKey()}-%`)
  ]);
  const withImg = ((products ?? []) as any[]).map((p) => ({ ...p, hasImage: (p.content_assets ?? []).some((a: any) => !a.deleted_at && a.asset_type === "image" && a.storage_ref) }));
  const style = normalizeStyle(await getSetting<any>(supabase, orgId, "collage.style", DEFAULT_STYLE));
  const ready = withImg.filter((p) => p.hasImage && !p.is_synthetic).length;

  return (
    <>
      <h1>Collages</h1>
      <p className="muted">Styled product boards for Pinterest and Instagram, built from the images you upload.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />

      <div className="card">
        <h2>This week&apos;s top 5</h2>
        <p className="muted small">
          The first time you open the app each week, I build a &quot;top 5&quot; collage for you automatically (turn it off with <code>collage.weekly_enabled</code> in Settings).
          It ranks by your own sales once you import reports, then by clicks, and until then by opportunity score. It needs at least 3 approved products that have an image ({ready} ready now).
        </p>
        {(thisWeek ?? []).length > 0 ? (
          <p>This week&apos;s collage is made. <Link href="/approvals">Open the Approval Queue</Link>.</p>
        ) : ready < 3 ? (
          <p>Add images for at least {3 - ready} more approved product{3 - ready > 1 ? "s" : ""} on <Link href="/images">Product Images</Link>.</p>
        ) : (
          <form action={makeWeeklyNow}><button className="primary" type="submit">Make this week&apos;s collage now</button></form>
        )}
      </div>

      <CollageImporter orgId={orgId} products={withImg.filter((p) => !p.is_synthetic).map((p) => ({ id: p.id, title: p.canonical_title }))} />

      <form action={saveDefaultStyle} className="card">
        <h2>My default style</h2>
        <p className="muted small">Used for the weekly collage and as the starting choice for new ones. Set your brand colors here once.</p>
        <StyleFields style={style} idPrefix="def_" />
        <div className="actions"><button type="submit">Save default style</button></div>
      </form>

      <form action={makeCollage}>
        <div className="card">
          <h2>Make your own collage</h2>
          <label htmlFor="preset">Title</label>
          <select id="preset" name="preset" defaultValue="finds">
            {TITLE_PRESETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            <option value="custom">Custom (use the two boxes below)</option>
          </select>
          <p className="muted small" style={{ marginBottom: 0 }}>For the custom option: a small heading above and a big title. Presets show the real number of products you pick.</p>
          <label htmlFor="title">Custom small heading</label>
          <input id="title" type="text" name="title" defaultValue="This Year's Favorite" maxLength={40} />
          <label htmlFor="subtitle">Custom big title</label>
          <input id="subtitle" type="text" name="subtitle" defaultValue="Summer Finds" maxLength={40} />
          <StyleFields style={style} idPrefix="new_" />
          <label className="check"><input type="checkbox" name="save_default" /> Save this font and color choice as my default</label>
          <label>Products (pick 2 to 6, in the order you want)</label>
          {withImg.length === 0 && <p className="muted small">No approved products yet.</p>}
          {withImg.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 8 }}>
              <label className="check" style={{ marginTop: 0 }}>
                <input type="checkbox" name="product_id" value={p.id} /> {p.canonical_title}
                {!p.hasImage && <span className="badge warn">no image yet</span>}
              </label>
              <input type="text" name={`label_${p.id}`} placeholder="Optional tag on the picture (e.g. mix + match)" maxLength={28} aria-label={`Tag for ${p.canonical_title}`} />
            </div>
          ))}
          <label>Make it for</label>
          <label className="check"><input type="checkbox" name="platform" value="pinterest" defaultChecked /> Pinterest pin (tall)</label>
          <label className="check"><input type="checkbox" name="platform" value="instagram" defaultChecked /> Instagram post</label>
          <label className="check"><input type="checkbox" name="platform" value="tiktok" /> TikTok photo post</label>
          <p className="muted small">Tags are checked by the rules engine like any other text (for example, price claims are blocked for Amazon products).</p>
          <div className="actions"><button className="primary" type="submit">Create collage</button></div>
        </div>
      </form>
    </>
  );
}
