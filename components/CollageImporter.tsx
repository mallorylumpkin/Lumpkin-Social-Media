"use client";

import { useState } from "react";
import { shrink } from "@/lib/image-tools";
import { createClient } from "@/lib/supabase/client";
import { importCollage } from "@/app/(app)/collages/actions";

type P = { id: string; title: string };

/** Upload a collage you made elsewhere (for example Amazon's Create Content > Collage) and send it through approval. */
export function CollageImporter({ orgId, products }: { orgId: string; products: P[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setMsg("Choose the collage image first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const blob = await shrink(file, 2000);
      const path = `${orgId}/imports/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("product-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      const fd = new FormData(e.currentTarget);
      fd.set("path", path);
      const res = await importCollage(fd);
      if (res && "error" in res) setMsg(res.error);
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("NEXT_REDIRECT")) setMsg(err?.message ?? "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h2>Import a collage you made elsewhere</h2>
      <p className="muted small">
        Made a collage in Amazon&apos;s <strong>Create Content → Collage</strong> (or any app)? Download it, upload it here, and it goes through the same caption, rules check, approval and calendar as everything else.
        Amazon says collages shared off Amazon need a link back to Amazon and your usual disclosure, which the caption and your links cover.
      </p>
      <label htmlFor="imp_file">Collage image (JPG or PNG)</label>
      <input id="imp_file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <label htmlFor="imp_title">Small heading for the caption</label>
      <input id="imp_title" name="title" type="text" defaultValue="Top Finds" maxLength={40} />
      <label htmlFor="imp_sub">Title for the caption</label>
      <input id="imp_sub" name="subtitle" type="text" defaultValue="Shop the look" maxLength={40} />
      <label>Products shown in the collage (for links and the rules check)</label>
      {products.length === 0 && <p className="muted small">Add and approve products first.</p>}
      {products.map((p) => (
        <label className="check" key={p.id}><input type="checkbox" name="product_id" value={p.id} /> {p.title}</label>
      ))}
      <label>Make it for</label>
      <label className="check"><input type="checkbox" name="platform" value="pinterest" defaultChecked /> Pinterest pin</label>
      <label className="check"><input type="checkbox" name="platform" value="instagram" defaultChecked /> Instagram post</label>
      <label htmlFor="imp_src">Where did the image come from?</label>
      <select id="imp_src" name="source" defaultValue="retailer_permitted">
        <option value="retailer_permitted">Made in an affiliate program&apos;s own tool (such as Amazon Create Content)</option>
        <option value="owner_provided">Made by me from my own photos</option>
      </select>
      <label className="check"><input type="checkbox" name="rights" value="yes" /> I have the right to use and share this image</label>
      {msg && <div className="flash err" style={{ marginTop: 12 }}>{msg}</div>}
      <div className="actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Importing…" : "Import and review"}</button></div>
    </form>
  );
}
