import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { sebookEnv } from "@/lib/env";
import { TODO_MARK } from "@/lib/seo";
import { hostSignUpHref } from "@/features/session/signIn";

export const INK = "#231F1C";
export const SOFT = "#4A4641";
export const MUTED = "#6E6A66";
export const LINE = "#ECE7E0";
export const PANEL = "#F7F5F2";
export const ACCENT = "#85C920";
export const ACCENT_HOVER = "#79B81C";
export const SERIF = "var(--font-playfair), Georgia, serif";
export const BODY = "var(--font-hanken), system-ui, sans-serif";

export const PROSE: CSSProperties = { margin: "0 0 12px", color: SOFT, fontSize: 16, lineHeight: 1.65 };

export function rich(text: string): ReactNode {
  const parts = text.split(TODO_MARK);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <Placeholder />}
      {part}
    </Fragment>
  ));
}

export function hostHref(): string | null {
  return hostSignUpHref(sebookEnv().authUrl);
}

export function Section({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 52 }}>
      <h2
        style={{
          fontFamily: SERIF,
          fontSize: "clamp(21px, 2.6vw, 28px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: INK,
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      {lead && <p style={{ margin: "0 0 18px", color: SOFT, fontSize: 16.5 }}>{lead}</p>}
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: 17.5, fontWeight: 700, color: INK, margin: "26px 0 8px" }}>{children}</h3>;
}

export function Placeholder({ children = "[À RENSEIGNER]" }: { children?: ReactNode }) {
  return (
    <mark
      style={{
        background: "#FFF3D6",
        color: "#7A5A12",
        padding: "1px 7px",
        borderRadius: 6,
        fontWeight: 600,
        fontSize: "0.95em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </mark>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 16 }}>{children}</div>
  );
}

export function LinkCard({ href, icon, title, desc }: { href: string; icon?: ReactNode; title: string; desc: ReactNode }) {
  return (
    <Link
      href={href}
      className="r-hover-border r-hover-shadow"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "20px 20px 22px",
        borderRadius: 16,
        border: `1px solid ${LINE}`,
        background: "#fff",
        textDecoration: "none",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
      }}
    >
      {icon && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 11,
            background: PANEL,
            fontSize: 20,
            marginBottom: 4,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ fontSize: 16.5, fontWeight: 700, color: INK }}>{typeof title === "string" ? rich(title) : title}</span>
      <span style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.5 }}>{typeof desc === "string" ? rich(desc) : desc}</span>
    </Link>
  );
}

export function Faq({ items }: { items: readonly { question: string; answer: ReactNode }[] }) {
  return (
    <div style={{ borderTop: `1px solid ${LINE}` }}>
      {items.map((entry) => (
        <details key={entry.question} className="r-faq" style={{ borderBottom: `1px solid ${LINE}` }}>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "18px 2px",
              minHeight: 44,
              fontSize: 16.5,
              fontWeight: 600,
              color: INK,
            }}
          >
            {entry.question}
            <span className="r-faq-plus" aria-hidden style={{ flexShrink: 0 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div style={{ padding: "0 2px 20px", color: SOFT, fontSize: 15.5, lineHeight: 1.65 }}>{typeof entry.answer === "string" ? rich(entry.answer) : entry.answer}</div>
        </details>
      ))}
    </div>
  );
}

export function CtaButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "outline" }) {
  const base = {
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 15,
    padding: "12px 24px",
    minHeight: 44,
    borderRadius: 11,
    display: "inline-block",
  } as const;
  const style = variant === "primary" ? { ...base, background: ACCENT, color: INK } : { ...base, border: `1px solid ${INK}`, color: INK };
  return (
    <Link href={href} className="r-hover-fade" style={style}>
      {children}
    </Link>
  );
}

export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 28,
        padding: "14px 18px",
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        color: SOFT,
        fontSize: 14.5,
      }}
    >
      {children}
    </div>
  );
}

export function PanelBox({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "22px 24px", borderRadius: 16, background: PANEL, border: `1px solid ${LINE}`, color: SOFT, fontSize: 16 }}>
      {children}
    </div>
  );
}

export function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol style={{ paddingLeft: 20, margin: 0, color: SOFT, fontSize: 16, display: "grid", gap: 8 }}>
      {steps.map((step) => (
        <li key={step}>{rich(step)}</li>
      ))}
    </ol>
  );
}
