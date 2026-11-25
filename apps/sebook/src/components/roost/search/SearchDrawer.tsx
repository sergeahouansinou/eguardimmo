"use client";

import { useI18n } from "@/lib/i18n/context";
import { CalendarField } from "./CalendarField";
import { DestinationField, type PlaceSuggestions } from "./DestinationField";
import { GuestsField } from "./GuestsField";
import { SearchIcon } from "./SearchIcon";
import { ACCENT_INK, drawerSectionTitle, INK, LINE } from "./styles";
import type { SearchForm } from "./useSearchForm";

export function SearchDrawer({
  form,
  suggestions,
  today,
  onClose,
  onSearch,
}: {
  form: SearchForm;
  suggestions: PlaceSuggestions;
  today: string;
  onClose: () => void;
  onSearch: () => void;
}) {
  const { t } = useI18n();
  const { text, checkIn, checkOut, guests } = form.state;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div aria-hidden="true" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,30,45,.45)" }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("searchStaysTitle")}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(440px, 92vw)", background: "#fff", boxShadow: "-12px 0 40px rgba(0,0,0,.22)", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #EFEBE6", flex: "0 0 auto" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{t("searchStaysTitle")}</span>
          <button type="button" aria-label={t("closeLabel")} onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK, fontSize: 18, lineHeight: 0 }}>
            ✕
          </button>
        </div>
        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: 18 }}>
          <section style={{ marginBottom: 22 }}>
            <h2 style={drawerSectionTitle}>{t("searchWhere")}</h2>
            <DestinationField text={text} onText={form.setText} onChoose={form.choosePlace} suggestions={suggestions} />
          </section>
          <section style={{ marginBottom: 22 }}>
            <h2 style={drawerSectionTitle}>{t("searchWhen")}</h2>
            <CalendarField today={today} checkIn={checkIn} checkOut={checkOut} onPick={(day) => { form.pickDay(day); }} />
          </section>
          <section>
            <h2 style={drawerSectionTitle}>{t("searchWho")}</h2>
            <GuestsField guests={guests} onChange={form.setGuests} />
          </section>
        </div>
        <div style={{ flex: "0 0 auto", padding: 16, borderTop: "1px solid #EFEBE6", display: "flex", gap: 12 }}>
          <button type="button" onClick={form.clear} style={{ flex: "0 0 auto", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 15, color: INK, textDecoration: "underline", padding: "0 6px" }}>
            {t("clearLabel")}
          </button>
          <button type="button" onClick={onSearch} style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#85C920", color: ACCENT_INK, border: "none", borderRadius: 14, height: 52, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 16 }}>
            <SearchIcon size={18} />
            {t("searchBtn")}
          </button>
        </div>
      </aside>
    </div>
  );
}
