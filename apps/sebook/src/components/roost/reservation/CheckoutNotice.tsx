"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { UI, NAVY } from "./styles";

export interface NoticeAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export default function CheckoutNotice({ title, text, actions }: { title: string; text: ReactNode; actions: NoticeAction[] }) {
  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "64px 24px 90px", textAlign: "center" }}>
      <h1 style={{ fontFamily: UI, fontWeight: 800, fontSize: "clamp(24px, 4vw, 30px)", letterSpacing: "-0.02em", margin: "0 0 12px", color: "#231F1C" }}>{title}</h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: "#6E6A66", margin: "0 0 26px" }}>{text}</p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
        {actions.map((action) =>
          action.href ? (
            <Link key={action.label} href={action.href} className="r-show-more" style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
              {action.label}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick} className="r-show-more" style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", minHeight: 48 }}>
              {action.label}
            </button>
          ),
        )}
      </div>
    </main>
  );
}
