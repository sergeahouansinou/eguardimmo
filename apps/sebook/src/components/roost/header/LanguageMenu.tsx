"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n/context";
import { LANGS } from "@/lib/i18n/dictionaries";

const optionStyle = (active: boolean): CSSProperties => ({
  textAlign: "left",
  border: `1px solid ${active ? "#231F1C" : "#E6E2DD"}`,
  background: active ? "#F4F1ED" : "#fff",
  borderRadius: 10,
  padding: "9px 11px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  color: "#231F1C",
  transition: "border-color .12s",
});

export function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  return (
    <div style={{ position: "absolute", top: 56, right: 44, zIndex: 70, background: "#fff", border: "1px solid #EBE7E2", borderRadius: 16, boxShadow: "0 12px 32px rgba(0,0,0,.16)", padding: 16, width: 266 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6E6A66", letterSpacing: ".06em", marginBottom: 10 }}>{t("languageLabel")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {LANGS.map((entry) => (
          <button
            key={entry.code}
            type="button"
            className="r-hover-border"
            aria-pressed={lang === entry.code}
            onClick={() => {
              setLang(entry.code);
            }}
            style={optionStyle(lang === entry.code)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
