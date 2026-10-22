import { createClient } from "@/lib/supabase/client";
import { registerImage } from "@/app/(app)/images/actions";
import { shrink, shrinkAndCut } from "@/lib/image-tools";

/** Shrinks each photo (optionally removing a plain background), uploads it to your private storage and records your rights confirmation. */
export async function uploadProductImages(a: { orgId: string; productId: string; files: File[]; source: string; cut: boolean }): Promise<{ uploaded: number; cut: number }> {
  const supabase = createClient();
  let uploaded = 0;
  let cutCount = 0;
  for (const f of a.files) {
    if (!f.type.startsWith("image/")) continue;
    let blob: Blob;
    let isPng = false;
    if (a.cut) {
      const r = await shrinkAndCut(f);
      blob = r.blob;
      isPng = r.removed;
      if (r.removed) cutCount++;
    } else {
      blob = await shrink(f);
    }
    const path = `${a.orgId}/${a.productId}/${crypto.randomUUID()}.${isPng ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: isPng ? "image/png" : "image/jpeg", upsert: false });
    if (error) throw new Error(error.message);
    const fd = new FormData();
    fd.set("product_id", a.productId);
    fd.set("path", path);
    fd.set("source", a.source);
    fd.set("rights", "yes");
    const res = await registerImage(fd);
    if (!res.ok) throw new Error(res.error);
    uploaded++;
  }
  return { uploaded, cut: cutCount };
}
