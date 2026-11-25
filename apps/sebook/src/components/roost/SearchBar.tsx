"use client";

import { useEffect, useState } from "react";
import { usePlaces } from "@/features/search/usePlaces";
import { useI18n } from "@/lib/i18n/context";
import { useToday } from "@/lib/useToday";
import type { Kind } from "@/marketplace/schemas";
import { SearchDrawer } from "./search/SearchDrawer";
import { SearchIcon } from "./search/SearchIcon";
import { type Segment, SearchPill } from "./search/SearchPill";
import { ACCENT_INK, INK, LINE } from "./search/styles";
import { useSearchForm } from "./search/useSearchForm";

export default function SearchBar({ scope = "short_stay" }: { scope?: Kind }) {
  const { t } = useI18n();
  const [segment, setSegment] = useState<Segment>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const today = useToday();
  const form = useSearchForm(scope, () => {
    setSegment(null);
    setMobileOpen(false);
  });
  const suggestions = usePlaces(form.state.text);
  const { text, checkIn, checkOut, guests } = form.state;

  const shortMonths = t("monthsShort").split(",");
  const formatDay = (iso: string) => {
    const [, month = 1, day = 1] = iso.split("-").map(Number);
    return `${shortMonths[month - 1] ?? ""} ${String(day)}`;
  };
  const search = () => {
    form.submit(suggestions.places[0] ?? null);
  };
  const datesSummary = checkIn && checkOut ? `${formatDay(checkIn)} – ${formatDay(checkOut)}` : t("searchAddDates");
  const guestsSummary = guests > 0 ? `${String(guests)} ${t("searchAddGuests")}` : t("searchAddGuests");

  const anyOpen = segment !== null || mobileOpen;
  useEffect(() => {
    if (!anyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSegment(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [anyOpen]);

  return (
    <>
      <SearchPill form={form} segment={segment} onSegment={setSegment} suggestions={suggestions} today={today} formatDay={formatDay} onSearch={search} />
      <div className="r-search-mobilewrap" style={{ position: "sticky", top: 80, zIndex: 60, padding: "10px 16px", marginTop: -34, marginBottom: 22 }}>
        <button
          type="button"
          onClick={() => {
            setMobileOpen(true);
          }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 30, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 18px rgba(30,40,60,.12)", textAlign: "left" }}
        >
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#85C920", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", color: ACCENT_INK }}>
            <SearchIcon size={17} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text || t("searchWhereTo")}</span>
            <span style={{ fontSize: 12, color: "#6E6A66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`${datesSummary} · ${guestsSummary}`}</span>
          </span>
        </button>
      </div>
      {mobileOpen && (
        <SearchDrawer
          form={form}
          suggestions={suggestions}
          today={today}
          onClose={() => {
            setMobileOpen(false);
          }}
          onSearch={search}
        />
      )}
    </>
  );
}
