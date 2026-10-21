export function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return <div className={`flash ${error ? "err" : "ok"}`}>{error ?? msg}</div>;
}

export function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function money(n: number | null | undefined): string {
  return n === null || n === undefined ? "n/a" : `$${Number(n).toFixed(2)}`;
}
