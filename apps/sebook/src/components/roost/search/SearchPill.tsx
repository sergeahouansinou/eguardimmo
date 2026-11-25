"use client";

import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";
import { CalendarField } from "./CalendarField";
import { DestinationField, type PlaceSuggestions } from "./DestinationField";
import { GuestsField } from "./GuestsField";
import { SearchIcon } from "./SearchIcon";
import { ACCENT_INK, INK, PLACEHOLDER, popoverStyle } from "./styles";
import type { SearchForm } from "./useSearchForm";

export type Segment = "where" | "checkin" | "checkout" | "who" | null;

const pillBackground =
  "linear-gradient(125deg, rgba(255,255,255,.98) 0%, rgba(241,245,250,.93) 30%, rgba(255,255,255,.98) 50%, rgba(238,243,249,.93) 72%, rgba(255,255,255,.98) 100%)";
const pillShadow =
  "0 12px 32px rgba(30,40,60,.18), inset 0 2px 3px rgba(255,255,255,1), inset 0 -3px 9px rgba(120,132,156,.16), inset 0 0 0 1px rgba(255,255,255,.35)";

function Divider() {
  return <div className="r-seg-divider" style={{ width: 1, background: "#E8E3DC", margin: "11px 0" }} />;
}

function SegmentButton({ active, flex, radius, label, value, filled, onClick }: { active: boolean; flex: number; radius: string; label: string; value: string; filled: boolean; onClick: () => void }) {
  const style: CSSProperties = {
    flex,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "13px 24px",
    border: "none",
    borderRadius: radius,
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    position: "relative",
    zIndex: 45,
    transition: "background .15s",
    fontFamily: "inherit",
    textAlign: "left",
    minWidth: 0,
  };
  return (
    <button type="button" className="r-hover-soft r-seg r-seg-row" aria-expanded={active} onClick={onClick} style={style}>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{label}</span>
      <span style={{ fontSize: 14, color: filled ? INK : PLACEHOLDER, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </button>
  );
}

function Popover({ children, position, padding, width }: { children: ReactNode; position: CSSProperties; padding: number | string; width: number }) {
  return (
    <div className="r-dd" style={{ ...popoverStyle, ...position, padding, width }}>
      {children}
    </div>
  );
}

export function SearchPill({
  form,
  segment,
  onSegment,
  suggestions,
  today,
  formatDay,
  onSearch,
}: {
  form: SearchForm;
  segment: Segment;
  onSegment: (segment: Segment) => void;
  suggestions: PlaceSuggestions;
  today: string;
  formatDay: (iso: string) => string;
  onSearch: () => void;
}) {
  const { t } = useI18n();
  const { text, checkIn, checkOut, guests } = form.state;
  const toggle = (target: Exclude<Segment, null>) => {
    onSegment(segment === target ? null : target);
  };

  return (
    <div className="r-searchwrap r-searchwrap-desktop" style={{ position: "sticky", top: 80, zIndex: 60, display: "flex", justifyContent: "center", padding: "10px 40px", marginTop: -48, marginBottom: 30 }}>
      <div
        className="r-searchbar"
        style={{
          display: "flex",
          alignItems: "stretch",
          background: pillBackground,
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          border: "1px solid rgba(255,255,255,.85)",
          borderRadius: 40,
          boxShadow: pillShadow,
          width: "100%",
          maxWidth: 860,
          position: "relative",
        }}
      >
        <SegmentButton active={segment === "where"} flex={1.3} radius="40px 0 0 40px" label={t("searchWhere")} value={text || t("searchDestinations")} filled={text !== ""} onClick={() => { toggle("where"); }} />
        <Divider />
        <SegmentButton active={segment === "checkin"} flex={1} radius="0" label={t("searchCheckIn")} value={checkIn ? formatDay(checkIn) : t("searchAddDates")} filled={checkIn !== ""} onClick={() => { onSegment("checkin"); }} />
        <Divider />
        <SegmentButton active={segment === "checkout"} flex={1} radius="0" label={t("searchCheckOut")} value={checkOut ? formatDay(checkOut) : t("searchAddDates")} filled={checkOut !== ""} onClick={() => { onSegment("checkout"); }} />
        <Divider />
        <div className="r-seg" style={{ flex: 1.3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 8px 8px 0", borderRadius: "0 40px 40px 0", background: segment === "who" ? "#fff" : "transparent", position: "relative", zIndex: 45, transition: "background .15s" }}>
          <button type="button" className="r-hover-soft" aria-expanded={segment === "who"} onClick={() => { toggle("who"); }} style={{ flex: 1, alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", padding: "0 0 0 24px", border: "none", borderRadius: "0 0 0 0", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{t("searchWho")}</span>
            <span style={{ fontSize: 14, color: guests > 0 ? INK : PLACEHOLDER, whiteSpace: "nowrap" }}>{guests > 0 ? `${String(guests)} ${t("searchAddGuests")}` : t("searchAddGuests")}</span>
          </button>
          <button type="button" className="r-search-btn" onClick={onSearch} style={{ display: "flex", alignItems: "center", gap: 8, background: "#85C920", color: ACCENT_INK, border: "none", borderRadius: 30, height: 48, padding: "0 18px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, flex: "0 0 auto" }}>
            <SearchIcon size={17} />
            {t("searchBtn")}
          </button>
        </div>

        {segment !== null && (
          <div
            aria-hidden="true"
            onClick={() => {
              onSegment(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
        )}

        {segment === "where" && (
          <Popover position={{ left: 0, textAlign: "left" }} padding={22} width={392}>
            <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 12 }}>{t("searchDestinations")}</div>
            <DestinationField text={text} onText={form.setText} onChoose={(place, label) => { form.choosePlace(place, label); onSegment("checkin"); }} suggestions={suggestions} />
          </Popover>
        )}
        {(segment === "checkin" || segment === "checkout") && (
          <Popover position={{ left: "50%", transform: "translateX(-50%)" }} padding={22} width={372}>
            <CalendarField today={today} checkIn={checkIn} checkOut={checkOut} onPick={(day) => { onSegment(form.pickDay(day)); }} />
          </Popover>
        )}
        {segment === "who" && (
          <Popover position={{ right: 0 }} padding="8px 24px" width={392}>
            <GuestsField guests={guests} onChange={form.setGuests} />
          </Popover>
        )}
      </div>
    </div>
  );
}
