"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { circleButton, INK } from "./styles";

const pad = (value: number) => String(value).padStart(2, "0");
const isoOf = (year: number, month: number, day: number) => `${String(year)}-${pad(month + 1)}-${pad(day)}`;

function Chevron({ d }: { d: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function CalendarField({
  today,
  checkIn,
  checkOut,
  onPick,
}: {
  today: string;
  checkIn: string;
  checkOut: string;
  onPick: (day: string) => void;
}) {
  const { t } = useI18n();
  const months = t("monthsLong").split(",");
  const weekdays = t("weekdays").split(",");
  const [shift, setShift] = useState(0);

  if (today === "") return null;
  const [todayYear = 0, todayMonth = 1] = today.split("-").map(Number);
  const base = todayYear * 12 + (todayMonth - 1) + shift;
  const year = Math.floor(base / 12);
  const month = base % 12;
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button
          type="button"
          aria-label={t("sbPrevMonth")}
          disabled={shift === 0}
          onClick={() => {
            setShift((value) => value - 1);
          }}
          style={{ ...circleButton, opacity: shift === 0 ? 0.3 : 1, cursor: shift === 0 ? "default" : "pointer" }}
        >
          <Chevron d="M15 6l-6 6 6 6" />
        </button>
        <span aria-live="polite" style={{ fontSize: 15, fontWeight: 700, color: INK }}>{`${months[month] ?? ""} ${String(year)}`}</span>
        <button
          type="button"
          aria-label={t("sbNextMonth")}
          onClick={() => {
            setShift((value) => value + 1);
          }}
          style={circleButton}
        >
          <Chevron d="M9 6l6 6-6 6" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
        {weekdays.map((day) => (
          <span key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9A958C" }}>
            {day}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span key={`vide-${String(index)}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const iso = isoOf(year, month, day);
          const past = iso < today;
          const selected = iso === checkIn || iso === checkOut;
          const inRange = checkIn !== "" && checkOut !== "" && iso > checkIn && iso < checkOut;
          return (
            <button
              key={iso}
              type="button"
              disabled={past}
              aria-pressed={selected}
              aria-label={`${String(day)} ${months[month] ?? ""} ${String(year)}`}
              onClick={() => {
                onPick(iso);
              }}
              style={{
                aspectRatio: "1",
                border: "none",
                borderRadius: "50%",
                background: selected ? INK : inRange ? "#F1ECE6" : "transparent",
                color: selected ? "#fff" : INK,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: selected ? 700 : 500,
                cursor: past ? "default" : "pointer",
                opacity: past ? 0.28 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </>
  );
}
