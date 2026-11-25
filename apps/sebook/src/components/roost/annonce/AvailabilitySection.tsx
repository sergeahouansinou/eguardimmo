"use client";

import { useState } from "react";
import MonthCalendar from "../MonthCalendar";
import { buildMonthCells, monthLabel, nextBlocked, prevBlocked, shiftMonth, shortDate } from "@/lib/calendar";
import { FONTS } from "@/lib/roost-data";
import { useI18n } from "@/lib/i18n/context";
import { MUTED, INK } from "./ui";
import type { StayState } from "./useStay";

interface Props {
  stay: StayState;
  where: string;
}

export function AvailabilitySection({ stay, where }: Props) {
  const { lang, t } = useI18n();
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const { today, lastDay, checkIn, checkOut, nights, minNights } = stay;
  const monthsLong = t("monthsLong").split(",");
  const monthsShort = t("monthsShort").split(",");

  const heading = nights > 0 ? t(nights > 1 ? "nightsIn" : "nightIn", { n: nights, city: where }) : t("availability");
  const sub = checkIn && checkOut ? `${shortDate(checkIn, monthsShort, lang) ?? ""} – ${shortDate(checkOut, monthsShort, lang) ?? ""}` : t("addTravelDates");

  const current = view ?? (checkIn && today && checkIn.y * 12 + checkIn.m >= today.y * 12 + today.m ? { y: checkIn.y, m: checkIn.m } : today ? { y: today.y, m: today.m } : null);

  return (
    <div style={{ padding: "28px 0 8px" }}>
      <h2 style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 21, margin: "0 0 2px", color: INK }}>{heading}</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 6px" }}>{sub}</p>
      {stay.availabilityFailed ? (
        <p role="alert" style={{ fontSize: 14, color: "#C0392B", margin: "0 0 12px" }}>
          {t("ficheAvailabilityError")}
        </p>
      ) : null}
      {minNights > 1 ? (
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: MUTED, margin: "0 0 18px" }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          {t("minStay", { n: minNights })}
        </p>
      ) : null}
      {today && lastDay && current ? (
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          {[0, 1].map((offset) => {
            const month = shiftMonth(current.y, current.m, offset, today);
            const first = offset === 0;
            return (
              <MonthCalendar
                key={offset}
                label={monthLabel(month.y, month.m, monthsLong)}
                cells={buildMonthCells(month.y, month.m, checkIn, checkOut, today, stay.blocked, lastDay)}
                onSelect={(day) => {
                  stay.pick(month.y, month.m, day);
                }}
                onPrev={
                  first
                    ? () => {
                        setView(shiftMonth(current.y, current.m, -1, today));
                      }
                    : undefined
                }
                onNext={
                  first
                    ? undefined
                    : () => {
                        setView(shiftMonth(current.y, current.m, 1, today));
                      }
                }
                prevDisabled={first && prevBlocked(current.y, current.m, today)}
                nextDisabled={!first && nextBlocked(month.y, month.m, lastDay)}
              />
            );
          })}
        </div>
      ) : (
        <div aria-hidden="true" style={{ minHeight: 300 }} />
      )}
    </div>
  );
}
