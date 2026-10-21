"use client";

import { useEffect, useState } from "react";

/** Shows a stored UTC time in the viewer's own time zone. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
  }, [iso]);
  return <span suppressHydrationWarning>{text || "…"}</span>;
}

/** Date-time picker in the viewer's time zone. Submits an exact UTC time and starts on the next suggested slot. */
export function LocalDateTime({ slots }: { slots: number[] }) {
  const [local, setLocal] = useState("");
  useEffect(() => {
    const now = new Date();
    for (let d = 0; d < 3; d++) {
      for (const h of slots) {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, 0, 0);
        if (t.getTime() > now.getTime() + 30 * 60 * 1000) {
          const pad = (n: number) => String(n).padStart(2, "0");
          setLocal(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:00`);
          return;
        }
      }
    }
  }, [slots]);
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} aria-label="Post time" />
      <input type="hidden" name="scheduled_iso" value={iso} />
    </>
  );
}
