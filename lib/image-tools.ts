// Browser-only helpers: shrink photos and remove plain backgrounds before upload.

// Shrinks the photo in the browser first (phone photos are huge), then uploads it straight to your private storage.
export async function shrink(file: File, max = 1400): Promise<Blob> {
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

export type Cut = { blob: Blob; removed: boolean };

/** Removes a plain (white or near-white) background by flood-filling from the edges, then crops to the product. Runs in your browser. */
export async function shrinkAndCut(file: File, max = 1200): Promise<Cut> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const px = (x: number, y: number) => (y * w + x) * 4;

  // The four corners must look alike, otherwise the background is not plain and we keep the photo as it is.
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)].map((i) => [d[i], d[i + 1], d[i + 2]]);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let spread = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) spread = Math.max(spread, dist(corners[i], corners[j]));
  if (spread > 40) return { blob: await toBlob(canvas, "image/jpeg", 0.88), removed: false };
  const bg = [0, 1, 2].map((k) => Math.round(corners.reduce((sum, c) => sum + c[k], 0) / 4));

  const TOL = 34;
  const gone = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const k = y * w + x;
    if (gone[k]) return;
    const i = k * 4;
    if (dist([d[i], d[i + 1], d[i + 2]], bg) <= TOL) {
      gone[k] = 1;
      stack.push(k);
    }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const i = k * 4;
      if (gone[k]) { d[i + 3] = 0; continue; }
      kept++;
      // Soften the edge: product pixels touching the removed area get partial transparency.
      const edge = (x > 0 && gone[k - 1]) || (x < w - 1 && gone[k + 1]) || (y > 0 && gone[k - w]) || (y < h - 1 && gone[k + w]);
      if (edge) d[i + 3] = 150;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  // If almost nothing was removed, or almost everything was, the guess was wrong: keep the original photo.
  const share = kept / (w * h);
  if (share > 0.97 || share < 0.04 || maxX < 0) {
    const plain = document.createElement("canvas");
    plain.width = w; plain.height = h;
    const pctx = plain.getContext("2d")!;
    pctx.fillStyle = "#ffffff"; pctx.fillRect(0, 0, w, h); pctx.drawImage(bitmap, 0, 0, w, h);
    return { blob: await toBlob(plain, "image/jpeg", 0.88), removed: false };
  }
  ctx.putImageData(img, 0, 0);
  const pad = Math.round(Math.max(w, h) * 0.02);
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2), ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return { blob: await toBlob(out, "image/png"), removed: true };
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the image"))), type, q));
}

