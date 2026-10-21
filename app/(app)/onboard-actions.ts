"use server";

import { redirect } from "next/navigation";
import { getContext } from "@/lib/org";

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-brand";
}

export async function onboard(formData: FormData) {
  const { supabase, user } = await getContext();
  const name = text(formData, "name");
  const boardName = text(formData, "board");
  if (!name) redirect("/?error=" + encodeURIComponent("Enter your brand name."));

  const slug = `${slugify(name)}-${user.id.slice(0, 6)}`;
  const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slug });
  if (error || !orgId) {
    redirect("/?error=" + encodeURIComponent(error?.message ?? "Could not create your workspace."));
  }

  const seed = await supabase.rpc("seed_default_collections", { p_org: orgId, p_prefix: name });
  if (seed.error) redirect("/?error=" + encodeURIComponent(seed.error.message));

  if (boardName) {
    const { data: pin } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("org_id", orgId)
      .eq("platform", "pinterest")
      .maybeSingle();
    if (pin) {
      await supabase.from("social_destinations").insert({
        org_id: orgId,
        social_account_id: pin.id,
        kind: "board",
        name: boardName
      });
    }
  }
  redirect("/?msg=" + encodeURIComponent("Workspace created. Finish the setup checklist below."));
}
