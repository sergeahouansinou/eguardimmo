"use client";

import Link from "next/link";
import { FONTS } from "@/lib/roost-data";
import { useT } from "@/lib/i18n/context";
import { INK, MUTED } from "./ui";

export function Unavailable() {
  const t = useT();
  return (
    <main className="r-annonce-main" style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 40px" }}>
      <h1 style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 27, letterSpacing: "-0.02em", color: INK, margin: "0 0 12px" }}>{t("ficheUnavailableTitle")}</h1>
      <p style={{ fontSize: 16, color: MUTED, margin: "0 0 24px", maxWidth: 520, lineHeight: 1.5 }}>{t("ficheUnavailableText")}</p>
      <Link href="/" className="r-hover-underline" style={{ color: INK, fontWeight: 600, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
        {t("ficheBackHome")}
      </Link>
    </main>
  );
}
