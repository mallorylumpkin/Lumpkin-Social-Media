import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "editor" | "viewer";

export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  return {
    supabase,
    user,
    orgId: (membership?.org_id as string | undefined) ?? null,
    role: (membership?.role as Role | undefined) ?? null
  };
});

export async function requireOrg() {
  const ctx = await getContext();
  if (!ctx.orgId) redirect("/");
  return { ...ctx, orgId: ctx.orgId as string };
}

export function canWrite(role: Role | null) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function canAdmin(role: Role | null) {
  return role === "owner" || role === "admin";
}
