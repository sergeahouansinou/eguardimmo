import type { ReactNode } from "react";

export const INK = "#231F1C";
export const MUTED = "#6E6A66";
export const LINE = "#E2DDD6";

export function FilterChip({ on, onClick, children, minWidth }: { on: boolean; onClick: () => void; children: ReactNode; minWidth?: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ minWidth, padding: "9px 14px", borderRadius: 22, border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : INK, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, transition: "background .12s,border-color .12s,color .12s" }}
    >
      {children}
    </button>
  );
}

export function FilterSection({ title, hint, last = false, children }: { title: string; hint?: string; last?: boolean; children: ReactNode }) {
  return (
    <section style={{ padding: "22px 0", borderBottom: last ? "none" : `1px solid ${LINE}` }}>
      <h3 style={{ margin: hint ? "0 0 4px" : "0 0 14px", fontSize: 16, fontWeight: 700, color: INK }}>{title}</h3>
      {hint && <p style={{ margin: "0 0 14px", fontSize: 13.5, color: MUTED }}>{hint}</p>}
      {children}
    </section>
  );
}
