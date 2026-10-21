"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canWrite, requireOrg } from "@/lib/org";
import { createPackage } from "@/lib/generate";
import { FORMATS, type Format } from "@/lib/content";

export async function generatePackage(formData: FormData) {
  const { supabase, orgId, user, role } = await requireOrg();
  const back = (k: "msg" | "error", m: string): never => redirect(`${k === "msg" ? "/approvals" : "/content"}?${k}=${encodeURIComponent(m)}`);
  if (!canWrite(role)) back("error", "Your role cannot create content.");

  const format = String(formData.get("format") ?? "") as Format;
  if (!FORMATS[format]) back("error", "Choose a format.");
  const productIds = formData.getAll("product_id").map(String).filter(Boolean);
  if (!productIds.length) back("error", "Tick at least one product.");
  const facts: Record<string, string> = {};
  for (const id of productIds) facts[id] = String(formData.get(`facts_${id}`) ?? "");
  const mode = formData.get("mode") === "template" ? "template" : "ai";

  const res = await createPackage({ supabase, orgId, userId: user.id, format, angle: String(formData.get("angle") ?? "problem_solution"), mode, productIds, facts });
  if ("error" in res) back("error", res.error);
  revalidatePath("/approvals");
  revalidatePath("/");
  back("msg", `Created a ${FORMATS[format].label.toLowerCase()}. Review it below, then approve.`);
}
