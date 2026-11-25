"use client";

import type { ReactNode } from "react";
import { FONTS } from "@/lib/roost-data";
import { NAVY } from "../reservation/styles";

interface PageNoticeProps {
  title?: string;
  text: ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  role?: "alert" | "status";
}

export default function PageNotice({ title, text, action, role }: PageNoticeProps) {
  const style = { background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", minHeight: 48, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center" } as const;
  return (
    <div role={role} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "72px 0", textAlign: "center", fontFamily: FONTS.body }}>
      {title ? <p style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 20, color: "#231F1C", margin: 0 }}>{title}</p> : null}
      <p style={{ fontSize: 16, lineHeight: 1.55, color: "#6E6A66", margin: 0, maxWidth: 520 }}>{text}</p>
      {action?.href ? (
        <a href={action.href} className="r-show-more" style={style}>
          {action.label}
        </a>
      ) : action ? (
        <button type="button" onClick={action.onClick} className="r-show-more" style={style}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
