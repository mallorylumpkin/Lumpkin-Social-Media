import { Flash, pick } from "@/components/Flash";
import { StudioEditor } from "@/components/StudioEditor";
import { requireOrg } from "@/lib/org";

export default async function StudioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireOrg();
  const [{ data: products }, { data: accts }] = await Promise.all([
    supabase.from("products").select("id, canonical_title").eq("org_id", orgId).eq("status", "approved").is("deleted_at", null).order("created_at", { ascending: false }).limit(80),
    supabase.from("social_accounts").select("platform, handle").eq("org_id", orgId).is("deleted_at", null)
  ]);
  const handle = (p: string) => ((accts ?? []) as any[]).find((a) => a.platform === p && a.handle && a.handle !== "planned")?.handle ?? null;
  return (
    <>
      <h1>Photo Studio</h1>
      <p className="muted">Upload product pictures or screenshots from your phone, remove the background, set them on a scene like a shopping cart or a picnic blanket, and save or send to approval.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      <StudioEditor orgId={orgId!} products={((products ?? []) as any[]).map((p) => ({ id: p.id, title: p.canonical_title }))} handles={{ instagram: handle("instagram"), tiktok: handle("tiktok") }} />
    </>
  );
}
