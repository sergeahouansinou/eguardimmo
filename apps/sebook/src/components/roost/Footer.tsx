"use client";

import Link from "next/link";
import { GlobeIcon } from "./icons";
import { useI18n } from "@/lib/i18n/context";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { LANGS } from "@/lib/i18n/dictionaries";
import { EMPTY_SEARCH, searchHref } from "@/marketplace/search";

const COLUMNS: { title: I18nKey; links: { key: I18nKey; href: string }[] }[] = [
  {
    title: "footerSupport",
    links: [
      { key: "fcl_helpCentre", href: "/aide" },
      { key: "fcl_safety", href: "/securite" },
      { key: "fcl_cancellation", href: "/annulation" },
      { key: "fcl_antidiscrimination", href: "/anti-discrimination" },
      { key: "fcl_disability", href: "/accessibilite" },
      { key: "fcl_report", href: "/signalement" },
    ],
  },
  {
    title: "footerHosting",
    links: [
      { key: "fch_resources", href: "/ressources" },
      { key: "fch_responsibly", href: "/conformite" },
    ],
  },
  {
    title: "footerCompany",
    links: [
      { key: "fcc_careers", href: "/carrieres" },
      { key: "fcc_newsroom", href: "/presse" },
      { key: "fcc_contact", href: "/contact" },
      { key: "fcc_privacy", href: "/confidentialite" },
      { key: "fcc_terms", href: "/conditions" },
    ],
  },
];

const EXPLORE_LINKS: { key: I18nKey; href: string }[] = [
  { key: "exploreStays", href: searchHref({ ...EMPTY_SEARCH, scope: "short_stay" }, "/destinations") },
  { key: "exploreLongTerm", href: searchHref({ ...EMPTY_SEARCH, scope: "long_term" }, "/destinations") },
  { key: "exploreFavorites", href: "/favorites" },
];

const LINK_STYLE = { textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 24 } as const;

export default function Footer() {
  const { t, lang, setLang } = useI18n();

  return (
    <footer style={{ background: "#F7F5F2", borderTop: "1px solid #EAE6E0" }}>
      <div className="r-foot-pad" style={{ width: "100%", padding: "52px 60px 12px" }}>
        <div className="r-foot-cols" style={{ display: "grid", gap: 30 }}>
          {COLUMNS.map((col) => (
            <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#231F1C", margin: "0 0 1px" }}>{t(col.title)}</h2>
              {col.links.map((link) => (
                <Link key={link.key} href={link.href} className="r-hover-underline" style={{ ...LINK_STYLE, fontSize: 15, color: "#4A4641" }}>
                  {t(link.key)}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <nav
          aria-label={t("footerExplore")}
          style={{
            marginTop: 40,
            paddingTop: 28,
            borderTop: "1px solid #E2DDD6",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px 18px",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#231F1C", marginRight: 4 }}>{t("footerExplore")}</span>
          {EXPLORE_LINKS.map((link) => (
            <Link key={link.key} href={link.href} className="r-hover-underline" style={{ ...LINK_STYLE, fontSize: 14, color: "#4A4641" }}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ borderTop: "1px solid #E6E1DA" }}>
        <div
          className="r-foot-bottom"
          style={{
            width: "100%",
            padding: "22px 60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "#6E6A66" }}>{t("footerCopyright")}</span>
          <div role="group" aria-label={t("languageAria")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ display: "flex", color: "#231F1C" }}>
              <GlobeIcon size={15} />
            </span>
            {LANGS.map((option) => {
              const active = option.code === lang;
              return (
                <button
                  key={option.code}
                  type="button"
                  lang={option.code}
                  aria-pressed={active}
                  onClick={() => {
                    setLang(option.code);
                  }}
                  className="r-hover-underline"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#231F1C" : "#6E6A66",
                    textDecoration: active ? "underline" : "none",
                    padding: "0 8px",
                    minHeight: 44,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
