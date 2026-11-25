"use client";

import { useEffect, useId, useState } from "react";
import { type FiltersDraft, FILTER_AMENITIES, GUEST_CHOICES, applyDraft, draftFromSearch, type FiltersErrors } from "@/lib/destination-filters";
import { useI18n } from "@/lib/i18n/context";
import { amenityLabel, SORT_LABELS } from "@/marketplace/labels";
import { SORTS } from "@/marketplace/schemas";
import type { SearchState } from "@/marketplace/search";
import { FilterChip, FilterSection, INK, LINE, MUTED } from "./destination/FilterChip";

const fieldStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 14, color: INK, outline: "none" } as const;

export default function DestinationFilters({ search, onClose, onApply }: { search: SearchState; onClose: () => void; onApply: (next: SearchState) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<FiltersDraft>(() => draftFromSearch(search));
  const [errors, setErrors] = useState<FiltersErrors>({});
  const minId = useId();
  const maxId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggleAmenity = (id: string) => {
    setDraft((current) => ({ ...current, amenities: current.amenities.includes(id) ? current.amenities.filter((item) => item !== id) : [...current.amenities, id] }));
  };
  const submit = () => {
    const result = applyDraft(search, draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onApply(result.search);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div aria-hidden="true" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)" }} />
      <div role="dialog" aria-modal="true" aria-label={t("filtersLabel")} style={{ position: "relative", width: "100%", maxWidth: 540, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 18px 60px rgba(0,0,0,.32)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${LINE}` }}>
          <button type="button" aria-label={t("closeLabel")} onClick={onClose} className="r-hover-soft" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{t("filtersLabel")}</span>
          <span style={{ width: 32 }} />
        </div>

        <div style={{ padding: "8px 24px 24px", overflowY: "auto" }}>
          <FilterSection title={t("fltGuests")} hint={draft.guests > 0 ? t("fltGuestsMin", { n: draft.guests }) : t("fltGuestsAny")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {GUEST_CHOICES.map((count) => (
                <FilterChip key={count} minWidth={52} on={draft.guests === count} onClick={() => { setDraft((current) => ({ ...current, guests: count })); }}>
                  {count === 0 ? t("fltGuestsAny") : count === 8 ? "8+" : String(count)}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection title={t("fltPriceRange")} hint={t("fltPriceRangeHint")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor={minId} style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }}>{t("fltMinPrice")}</label>
                <input id={minId} inputMode="numeric" value={draft.minPrice} aria-invalid={errors.minPrice === true || errors.range === true} onChange={(event) => { setDraft((current) => ({ ...current, minPrice: event.target.value })); }} style={fieldStyle} />
              </div>
              <div>
                <label htmlFor={maxId} style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }}>{t("fltMaxPrice")}</label>
                <input id={maxId} inputMode="numeric" value={draft.maxPrice} aria-invalid={errors.maxPrice === true} onChange={(event) => { setDraft((current) => ({ ...current, maxPrice: event.target.value })); }} style={fieldStyle} />
              </div>
            </div>
            {(errors.minPrice === true || errors.maxPrice === true || errors.range === true) && (
              <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#B3321F" }}>{errors.range === true ? t("fltPriceRangeInvalid") : t("fltPriceInvalid")}</p>
            )}
          </FilterSection>

          <FilterSection title={t("fltAmenities")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {FILTER_AMENITIES.map((id) => (
                <FilterChip key={id} on={draft.amenities.includes(id)} onClick={() => { toggleAmenity(id); }}>
                  {amenityLabel(id)}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection title={t("fltSort")} last>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SORTS.map((sort) => (
                <FilterChip key={sort} on={draft.sort === sort} onClick={() => { setDraft((current) => ({ ...current, sort })); }}>
                  {SORT_LABELS[sort]}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${LINE}` }}>
          <button type="button" onClick={() => { setDraft({ guests: 0, minPrice: "", maxPrice: "", amenities: [], sort: "relevance" }); setErrors({}); }} className="r-hover-fade" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: INK, textDecoration: "underline", padding: "6px 4px" }}>
            {t("fltClear")}
          </button>
          <button type="button" onClick={submit} className="r-hover-fade" style={{ background: INK, color: "#fff", border: "none", borderRadius: 11, padding: "12px 22px", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700 }}>
            {t("sbFiltersApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
