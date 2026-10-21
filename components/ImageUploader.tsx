"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerImage } from "@/app/(app)/images/actions";

// Shrinks the photo in the browser first (phone photos are huge), then uploads it straight to your private storage.
async function shrink(file: File, max = 1400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the image"))), "image/jpeg", 0.88));
}

export function ImageUploader({ orgId, productId }: { orgId: string; productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [source, setSource] = useState("owner_provided");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (!rights) {
      setMsg("Tick the box confirming you have the right to use these images first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      for (const f of files) {
        const blob = await shrink(f);
        const path = `${orgId}/${productId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);
        const fd = new FormData();
        fd.set("product_id", productId);
        fd.set("path", path);
        fd.set("source", source);
        fd.set("rights", "yes");
        const res = await registerImage(fd);
        if (!res.ok) throw new Error(res.error);
      }
      setMsg("Uploaded.");
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={`src_${productId}`} style={{ marginTop: 0 }}>Where did the image come from?</label>
      <select id={`src_${productId}`} value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="owner_provided">My own photo or screenshot I made</option>
        <option value="retailer_permitted">From my affiliate program&apos;s own tools (allowed for my use)</option>
        <option value="official_product_media">Brand or press media I have permission to use</option>
      </select>
      <label className="check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> I have the right to use these images in my posts
      </label>
      <input type="file" accept="image/*" multiple disabled={busy} onChange={onPick} style={{ marginTop: 8 }} aria-label="Choose images" />
      {busy && <p className="muted small">Uploading…</p>}
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
