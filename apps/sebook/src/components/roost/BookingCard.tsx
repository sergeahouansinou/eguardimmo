"use client";

import Link from "next/link";
import { useId, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import { GuestsButton, GuestsPopover, fieldLabelStyle } from "./annonce/GuestsPicker";
import { QuoteSection } from "./annonce/QuoteLines";
import { INK, MUTED, outlineBtn, reserveBtn } from "./annonce/ui";
import { useEscape } from "./annonce/useEscape";
import type { StayState } from "./annonce/useStay";
import { buildMonthCells, monthLabel, nextBlocked, prevBlocked, shiftMonth, shortDate } from "@/lib/calendar";
import { useI18n } from "@/lib/i18n/context";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import type { AnnonceView } from "@/marketplace/roostDetail";
import type { StayProblem } from "@/marketplace/stay";

export interface BookingCardProps {
  view: Pick<AnnonceView, "kind" | "priceLabel" | "priceUnitKey" | "capacity">;
  stay: StayState;
  onRequestVisit: () => void;
}

const PROBLEM_KEYS: Record<StayProblem, I18nKey | null> = {
  incomplete: null,
  past: "fichePastDate",
  order: "ficheOrder",
  minNights: "errMinStay",
  guests: "ficheGuestsRange",
  occupied: "ficheDatesUnavailable",
};

const dateButton = { textAlign: "left", border: "none", padding: "11px 14px", minHeight: 44, cursor: "pointer", fontFamily: "inherit" } as const;

function PriceHeader({ view }: { view: BookingCardProps["view"] }) {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={{ fontSize: 23, fontWeight: 800, color: INK }}>{view.priceLabel}</span>
      <span style={{ fontSize: 16, color: MUTED }}> / {t(view.priceUnitKey)}</span>
    </div>
  );
}

function VisitButton({ primary, onClick }: { primary: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary ? "r-reserve" : "r-hover-soft"}
      style={primary ? reserveBtn : { ...outlineBtn, width: "100%", marginTop: 12, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: 700 }}
    >
      {t("requestViewing")}
    </button>
  );
}

function StayCard({ view, stay, onRequestVisit }: BookingCardProps) {
  const { lang, t } = useI18n();
  const ids = { dates: useId(), guests: useId() };
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [pop, setPop] = useState<{ y: number; m: number } | null>(null);
  const { today, lastDay, checkIn, checkOut } = stay;
  const monthsLong = t("monthsLong").split(",");
  const monthsShort = t("monthsShort").split(",");

  useEscape(datesOpen || guestsOpen, () => {
    setDatesOpen(false);
    setGuestsOpen(false);
  });

  const canReserve = stay.reserveHref !== null && stay.quote.data?.available === true;
  const problemKey = stay.problem ? PROBLEM_KEYS[stay.problem] : null;
  const popView = pop ?? (checkIn && today && checkIn.y * 12 + checkIn.m >= today.y * 12 + today.m ? { y: checkIn.y, m: checkIn.m } : today);
  const toggleDates = () => {
    setDatesOpen((value) => !value);
    setGuestsOpen(false);
  };

  let reserveLabel = t("reserveWord");
  if (stay.problem === "minNights") reserveLabel = t("selectMinStay", { n: stay.minNights });
  else if (stay.nights === 0) reserveLabel = t("checkAvailability");

  return (
    <>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ border: "1px solid #C9C3BA", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <button type="button" aria-expanded={datesOpen} aria-controls={ids.dates} onClick={toggleDates} style={{ ...dateButton, borderRight: "1px solid #C9C3BA", background: datesOpen ? "#F7F5F2" : "#fff" }}>
              <span style={{ display: "block", ...fieldLabelStyle }}>{t("bcCheckIn")}</span>
              <span style={{ display: "block", fontSize: 14, color: checkIn ? INK : "#6E6A66", marginTop: 2 }}>{shortDate(checkIn, monthsShort, lang) ?? t("addDate")}</span>
            </button>
            <button type="button" aria-expanded={datesOpen} aria-controls={ids.dates} onClick={toggleDates} style={{ ...dateButton, background: datesOpen ? "#F7F5F2" : "#fff" }}>
              <span style={{ display: "block", ...fieldLabelStyle }}>{t("bcCheckOut")}</span>
              <span style={{ display: "block", fontSize: 14, color: checkOut ? INK : "#6E6A66", marginTop: 2 }}>{shortDate(checkOut, monthsShort, lang) ?? t("addDate")}</span>
            </button>
          </div>
          <div style={{ borderTop: "1px solid #C9C3BA" }}>
            <GuestsButton
              guests={stay.guests}
              open={guestsOpen}
              controls={ids.guests}
              onToggle={() => {
                setGuestsOpen((value) => !value);
                setDatesOpen(false);
              }}
            />
          </div>
        </div>
        {guestsOpen ? <GuestsPopover id={ids.guests} guests={stay.guests} capacity={view.capacity} onChange={stay.setGuests} /> : null}
      </div>

      {datesOpen ? (
        <div id={ids.dates} role="group" aria-label={t("ficheDatesPicker")} style={{ border: "1px solid #E5E0D9", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          {today && lastDay && popView ? (
            <MonthCalendar
              compact
              label={monthLabel(popView.y, popView.m, monthsLong)}
              cells={buildMonthCells(popView.y, popView.m, checkIn, checkOut, today, stay.blocked, lastDay)}
              onSelect={(day) => {
                stay.pick(popView.y, popView.m, day);
              }}
              onPrev={() => {
                setPop(shiftMonth(popView.y, popView.m, -1, today));
              }}
              onNext={() => {
                setPop(shiftMonth(popView.y, popView.m, 1, today));
              }}
              prevDisabled={prevBlocked(popView.y, popView.m, today)}
              nextDisabled={nextBlocked(popView.y, popView.m, lastDay)}
            />
          ) : null}
        </div>
      ) : null}

      {stay.minNights > 1 ? (
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: MUTED, margin: "0 0 12px" }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          {t("minStay", { n: stay.minNights })}
        </p>
      ) : null}
      {problemKey ? (
        <p role="status" style={{ fontSize: 14, color: "#C0392B", margin: "0 0 12px" }}>
          {t(problemKey, { n: stay.minNights, max: view.capacity })}
        </p>
      ) : null}

      {canReserve && stay.reserveHref ? (
        <Link href={stay.reserveHref} className="r-reserve" style={reserveBtn}>
          {t("reserveWord")}
        </Link>
      ) : (
        <button type="button" className="r-reserve" disabled aria-disabled="true" style={{ ...reserveBtn, cursor: "not-allowed", opacity: 0.5 }}>
          {reserveLabel}
        </button>
      )}
      <p style={{ textAlign: "center", fontSize: 14, color: MUTED, margin: "13px 0 0" }}>
        {canReserve ? t("wontBeCharged") : stay.nights === 0 ? t("selectDatesToSeeTotal") : null}
      </p>
      <QuoteSection stay={stay} />
      <VisitButton primary={false} onClick={onRequestVisit} />
    </>
  );
}

export default function BookingCard({ view, stay, onRequestVisit }: BookingCardProps) {
  const { t } = useI18n();
  return (
    <div style={{ flex: "0 0 372px" }} className="r-annonce-booking">
      <section aria-label={t("ficheBookingAria")} style={{ border: "1px solid #E5E0D9", borderRadius: 18, boxShadow: "0 6px 22px rgba(40,40,40,.10)", padding: 24 }}>
        <PriceHeader view={view} />
        {view.kind === "short_stay" ? (
          <StayCard view={view} stay={stay} onRequestVisit={onRequestVisit} />
        ) : (
          <>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, margin: "0 0 18px" }}>{t("ficheLongTermNote")}</p>
            <VisitButton primary onClick={onRequestVisit} />
          </>
        )}
      </section>
    </div>
  );
}
