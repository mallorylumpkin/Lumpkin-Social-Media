"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";
import { createCollage, rankTopProducts, weekKey } from "@/lib/collage";

function go(kind: "msg" | "error", m: string, path = "/collages"): never {
  revalidatePath("/approvals"); revalidatePath("/collages"); revalidatePath("/");
  redirect(`${path}?${kind}=${encodeURIComponent(m)}`);
}

export async function makeWeeklyNow() {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot create collages.");
  const { products, basis } = await rankTopProducts(supabase, orgId, 5, true);
  if (products.length < 3) go("error", "I need at least 3 approved products that have an uploaded image. Add images on the Product Images page first.");
  const subtitle = basis === "sales" ? `Top ${products.length} Best Sellers` : basis === "clicks" ? `Top ${products.length} Most Clicked` : `Top ${products.length} Picks`;
  const res = await createCollage({
    supabase, orgId, userId: user.id, productIds: products.map((p) => p.id), title: "This Week's Favorites", subtitle, labels: products.map((_, i) => `#${i + 1}`),
    platforms: ["pinterest", "instagram"], keyPrefix: `mlk-collage-${weekKey()}`
  });
  if ("error" in res) go("error", res.error === "This collage already exists." ? "This week's collage was already made. Find it in the Approval Queue." : res.error);
  go("msg", `Made this week's collage (${subtitle}). Review it in the Approval Queue.`, "/approvals");
}

export async function makeCollage(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  if (!canWrite(role)) go("error", "Your role cannot create collages.");
  const ids = formData.getAll("product_id").map(String);
  const title = String(formData.get("title") ?? "").trim().slice(0, 40) || "My Favorites";
  const subtitle = String(formData.get("subtitle") ?? "").trim().slice(0, 40);
  const platforms = formData.getAll("platform").map(String).filter((p): p is "pinterest" | "instagram" => p === "pinterest" || p === "instagram");
  const labels = ids.map((id) => String(formData.get(`label_${id}`) ?? "").trim().slice(0, 28));
  const res = await createCollage({ supabase, orgId, userId: user.id, productIds: ids, title, subtitle, labels, platforms, keyPrefix: `mlk-collage-m-${Math.random().toString(36).slice(2, 9)}` });
  if ("error" in res) go("error", res.error);
  go("msg", "Collage created. Review it in the Approval Queue.", "/approvals");
}
