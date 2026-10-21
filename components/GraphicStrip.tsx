import { graphicCount } from "@/lib/graphics";

/** Thumbnails of the generated text graphics for a package, each with a download link. */
export function GraphicStrip({ versionId, platform, onScreenText, collage }: { versionId: string; platform: string; onScreenText: unknown; collage?: boolean }) {
  if (collage) {
    const src = `/api/collage?v=${versionId}`;
    return (
      <div style={{ marginTop: 10 }}>
        <strong className="small">Collage image</strong>
        <div style={{ marginTop: 6, maxWidth: 220 }}>
          <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Collage" loading="lazy" style={{ width: 220, borderRadius: 8, border: "1px solid var(--line)", display: "block" }} /></a>
          <a className="small" href={`${src}&dl=1`} download>Download</a>
        </div>
      </div>
    );
  }
  const n = graphicCount(platform, onScreenText);
  return (
    <div style={{ marginTop: 10 }}>
      <strong className="small">Images ({n})</strong>
      <div className="row" style={{ alignItems: "flex-start", marginTop: 6, gap: 12 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ width: 110 }}>
            <a href={`/api/graphic?v=${versionId}&i=${i}`} target="_blank" rel="noreferrer">
              <img src={`/api/graphic?v=${versionId}&i=${i}`} alt={`Graphic ${i + 1}`} loading="lazy" style={{ width: 110, borderRadius: 8, border: "1px solid var(--line)", display: "block" }} />
            </a>
            <a className="small" href={`/api/graphic?v=${versionId}&i=${i}&dl=1`} download>Download</a>
          </div>
        ))}
      </div>
    </div>
  );
}
