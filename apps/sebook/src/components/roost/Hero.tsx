"use client";

import Image from "next/image";
import { FONTS } from "@/lib/roost-data";
import { useI18n } from "@/lib/i18n/context";

export default function Hero() {
  const { t } = useI18n();
  return (
    <section
      data-screen-label="Hero"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 420,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(56px, 9vw, 88px) 24px clamp(64px, 10vw, 96px)",
      }}
    >
      {/* Background banner */}
      <Image
        src="/images/banner.webp"
        alt={t("heroImageAlt")}
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        style={{ objectFit: "cover", objectPosition: "center 35%", zIndex: 0 }}
      />
      {/* Legibility scrim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(to bottom, rgba(8,30,55,.48) 0%, rgba(8,30,55,.22) 45%, rgba(8,30,55,.5) 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 4, textAlign: "center", maxWidth: 880, padding: "0 20px" }}>
        <h1 style={{ fontFamily: FONTS.ui, fontWeight: 800, fontSize: "clamp(30px, 6.5vw, 62px)", lineHeight: 1.05, color: "#fff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 30px rgba(8,30,55,.55)" }}>
          {t("heroTitle")}
        </h1>
        <p style={{ fontSize: "clamp(15px, 2.2vw, 19px)", lineHeight: 1.5, color: "rgba(255,255,255,.96)", margin: "18px auto 0", maxWidth: 560, textShadow: "0 1px 16px rgba(8,30,55,.6)" }}>
          {t("heroSubtitle")}
        </p>
      </div>
    </section>
  );
}
