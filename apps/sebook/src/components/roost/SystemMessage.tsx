"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FONTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";

const BUTTON = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 22px",
  borderRadius: 11,
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  cursor: "pointer",
} as const;

function Frame({ code, title, text, children }: { code?: string; title: string; text: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontFamily: FONTS.body,
        color: "#231F1C",
        textAlign: "center",
        padding: 24,
      }}
    >
      {code && <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#79B81C" }}>{code}</span>}
      <h1 style={{ fontFamily: FONTS.serif, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
        {title}
      </h1>
      <p style={{ fontSize: 16, color: "#6E6A66", maxWidth: 440, margin: 0, lineHeight: 1.6 }}>{text}</p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 10 }}>{children}</div>
    </div>
  );
}

export function NotFoundMessage() {
  const t = useT();
  return (
    <Frame code={t("notFoundCode")} title={t("notFoundTitle")} text={t("notFoundText")}>
      <Link href="/" className="r-hover-fade" style={{ ...BUTTON, background: "#85C920", color: "#231F1C" }}>
        {t("notFoundHome")}
      </Link>
      <Link
        href={searchHref(EMPTY_SEARCH, "/destinations")}
        className="r-hover-fade"
        style={{ ...BUTTON, border: "1px solid #231F1C", color: "#231F1C" }}
      >
        {t("notFoundBrowse")}
      </Link>
    </Frame>
  );
}

export function ErrorMessage({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div role="alert">
      <Frame title={t("errorTitle")} text={t("errorText")}>
        <button type="button" onClick={onRetry} className="r-hover-fade" style={{ ...BUTTON, border: "none", background: "#231F1C", color: "#fff" }}>
          {t("errorRetry")}
        </button>
      </Frame>
    </div>
  );
}
