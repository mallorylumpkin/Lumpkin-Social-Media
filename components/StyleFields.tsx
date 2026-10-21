import { FONTS, SCHEMES, normalizeStyle, resolveScheme, type CollageStyle } from "@/lib/collage-style";

/** Font, color scheme and optional custom colors. Plain form fields: font, scheme, c_bg, c_text, c_accent. */
export function StyleFields({ style, idPrefix = "" }: { style: CollageStyle; idPrefix?: string }) {
  const s = normalizeStyle(style);
  const base = resolveScheme(s.scheme === "custom" ? { ...s, scheme: "cream" } : s);
  const custom = s.custom ?? { bg: base.bg, text: base.text, accent: base.tagBg };
  return (
    <>
      <label htmlFor={`${idPrefix}font`}>Font</label>
      <select id={`${idPrefix}font`} name="font" defaultValue={s.font}>
        {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label} ({f.note})</option>)}
      </select>
      <label htmlFor={`${idPrefix}scheme`}>Color scheme</label>
      <select id={`${idPrefix}scheme`} name="scheme" defaultValue={s.scheme}>
        {Object.entries(SCHEMES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        <option value="custom">Custom colors (my brand colors)</option>
      </select>
      <p className="muted small" style={{ marginBottom: 0 }}>Custom colors are used only when &quot;Custom colors&quot; is selected above.</p>
      <div className="row" style={{ marginTop: 6 }}>
        <label style={{ margin: 0 }}>Background <input type="color" name="c_bg" defaultValue={custom.bg} style={{ width: 56, height: 40, padding: 2 }} /></label>
        <label style={{ margin: 0 }}>Text <input type="color" name="c_text" defaultValue={custom.text} style={{ width: 56, height: 40, padding: 2 }} /></label>
        <label style={{ margin: 0 }}>Tags / accent <input type="color" name="c_accent" defaultValue={custom.accent} style={{ width: 56, height: 40, padding: 2 }} /></label>
      </div>
    </>
  );
}
