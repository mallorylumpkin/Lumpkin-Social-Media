import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org";

const SECTIONS: Record<string, { title: string; text: string; phase: string }> = {
  analytics: { title: "Analytics", text: "Clicks, commissions, and earnings per click from your imported reports, labeled reported or estimated.", phase: "Phase 5 (report imports)" },
  experiments: { title: "Experiments", text: "Structured tests of hooks, formats, and times.", phase: "Phase 6 (needs enough performance data)" },
  automations: { title: "Automations", text: "Daily limits, spend caps, failure thresholds, and per-platform pauses.", phase: "Phase 4" }
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = SECTIONS[section];
  if (!s) notFound();
  await requireOrg();
  return (
    <>
      <h1>{s.title}</h1>
      <div className="card">
        <p>{s.text}</p>
        <p className="muted">Planned for: {s.phase}. The database tables for this section already exist.</p>
        <Link className="btn" href="/">Back to Today</Link>
      </div>
    </>
  );
}
