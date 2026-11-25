"use client";

import Image from "next/image";
import { FONTS } from "@/lib/roost-data";
import { useI18n } from "@/lib/i18n/context";

const APP_STORE_URL =
  "https://apps.apple.com/fr/app/eguardimmo-gestion-locative/id6746634073";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=serge.ahouansinou.eguardimmo";

export default function AppCta() {
  const { t } = useI18n();
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        background: "#E7DDCD",
        padding: "56px 0 0",
        overflow: "hidden",
      }}
    >
      <div
        className="r-cta-grid"
        style={{
          position: "relative",
          zIndex: 3,
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 40px",
          display: "flex",
          alignItems: "center",
          gap: 48,
        }}
      >
        <div
          className="r-cta-text"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            textAlign: "left",
          }}
        >
        <span
          style={{
            fontFamily: FONTS.script,
            fontWeight: 700,
            fontSize: 23,
            color: "#D98A4E",
          }}
        >
          {t('ctaKicker')}
        </span>
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontWeight: 700,
            fontSize: "clamp(24px, 4vw, 46px)",
            lineHeight: 1.08,
            color: "#2E2A24",
            margin: "4px 0 0",
            letterSpacing: "-0.01em",
          }}
        >
          {t('ctaTitle')}
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "#6B6358",
            margin: "16px 0 0",
            lineHeight: 1.55,
          }}
        >
          {t('ctaText')}
        </p>
        <div
          className="r-cta-btns"
          style={{
            display: "flex",
            justifyContent: "flex-start",
            flexWrap: "wrap",
            gap: 13,
            marginTop: 30,
          }}
        >
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="r-hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 11,
              background: "#113242",
              color: "#fff",
              borderRadius: 14,
              padding: "11px 19px",
              textDecoration: "none",
              flex: "0 0 auto",
              whiteSpace: "nowrap",
              transition: "transform .12s,box-shadow .12s",
            }}
          >
            <svg width={23} height={23} viewBox="0 0 24 24" fill="#fff">
              <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.55 0 2 .83 3.36.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13zM14.53 4.6c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
            </svg>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 10, color: "#B9B7CC" }}>
                {t('ctaDownloadOn')}
              </span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>App Store</span>
            </span>
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="r-hover-lift"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 11,
              background: "#113242",
              color: "#fff",
              borderRadius: 14,
              padding: "11px 19px",
              textDecoration: "none",
              flex: "0 0 auto",
              whiteSpace: "nowrap",
              transition: "transform .12s,box-shadow .12s",
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24">
              <path
                d="M3.6 2.1 13.2 11.7 3.6 21.3c-.36-.18-.6-.55-.6-1.02V3.12c0-.47.24-.84.6-1.02z"
                fill="#3BCCFF"
              />
              <path
                d="M3.6 2.1c.13-.06.27-.1.42-.1.27 0 .53.1.74.28l9.7 5.55-2.36 2.36L3.6 2.1z"
                fill="#3FE07E"
              />
              <path
                d="m12.1 12.55 2.36 2.36-9.7 5.55c-.21.18-.47.28-.74.28-.15 0-.29-.04-.42-.1l8.5-8.09z"
                fill="#FF6B6B"
              />
              <path
                d="m14.46 9.39 3.2 1.83c.6.34.6 1.21 0 1.56l-3.2 1.83-2.36-2.36 2.36-2.36z"
                fill="#FFCE45"
              />
            </svg>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 10, color: "#B9B7CC" }}>{t('ctaGetItOn')}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Google Play</span>
            </span>
          </a>
        </div>
        </div>

        {/* RIGHT : capture réelle de l'app eGuardImmo (fiche locataire + tableau de bord) */}
        <div
          className="r-cta-visual"
          style={{ flex: "1 1 0", minWidth: 0, display: "flex", justifyContent: "center" }}
        >
          <Image
            src="/images/app-mockup.webp"
            alt="Application eGuardImmo : fiche locataire et tableau de bord de gestion"
            width={3447}
            height={3339}
            sizes="(max-width: 760px) 90vw, 520px"
            style={{ width: "100%", maxWidth: 540, height: "auto" }}
          />
        </div>
      </div>
    </section>
  );
}
