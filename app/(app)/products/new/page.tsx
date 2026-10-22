import { Flash, pick } from "@/components/Flash";
import { requireOrg } from "@/lib/org";
import { creatorsConfigured } from "@/lib/amazon-creators";
import { AddProductForm } from "@/components/AddProductForm";

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { orgId } = await requireOrg();
  return (
    <>
      <h1>Add a product</h1>
      <p className="muted">
        {creatorsConfigured() ? (
          <>Paste an Amazon product link and I fill in the name, price and your affiliate link from Amazon&apos;s official Creators API. Star ratings and review counts are not available from it, so type them in if you want them scored. For other stores, type the details yourself.</>
        ) : (
          <>Paste the product page link. The app reads only the link you paste; it does not open or scrape the page, so type in the price and ratings you see.</>
        )}{" "}
        Anything you leave blank is stored as unavailable, never as zero.
      </p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      <AddProductForm orgId={orgId} apiOn={creatorsConfigured()} />
    </>
  );
}
