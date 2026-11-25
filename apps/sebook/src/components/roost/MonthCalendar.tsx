"use client";

import type { DayCell } from "@/lib/calendar";
import { useT } from "@/lib/i18n/context";

interface MonthCalendarProps {
  label: string;
  cells: readonly DayCell[];
  onSelect: (day: number) => void;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  prevDisabled?: boolean | undefined;
  nextDisabled?: boolean | undefined;
  compact?: boolean | undefined;
}

function Arrow({ direction, handler, disabled, compact, label }: { direction: "prev" | "next"; handler: (() => void) | undefined; disabled: boolean; compact: boolean; label: string }) {
  const size = compact ? 30 : 34;
  if (!handler) return <span style={{ width: size, height: size }} />;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={handler}
      disabled={disabled}
      className="r-hover-soft"
      style={{
        width: 44,
        height: 44,
        margin: `${String((size - 44) / 2)}px`,
        borderRadius: "50%",
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#231F1C",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <svg width={compact ? 14 : 15} height={compact ? 14 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

export default function MonthCalendar({ label, cells, onSelect, onPrev, onNext, prevDisabled, nextDisabled, compact = false }: MonthCalendarProps) {
  const t = useT();
  const fontSize = compact ? 12 : 13;
  const headFont = compact ? 10 : 11;
  const sundayFirst = t("weekdays").split(",");
  const weekdays = [...sundayFirst.slice(1), ...sundayFirst.slice(0, 1)];

  return (
    <div style={{ flex: compact ? undefined : "1 1 280px", minWidth: compact ? undefined : 260 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: compact ? 12 : 14 }}>
        <Arrow direction="prev" handler={onPrev} disabled={prevDisabled ?? false} compact={compact} label={t("ficheCalPrev")} />
        <span style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: "#231F1C" }}>{label}</span>
        <Arrow direction="next" handler={onNext} disabled={nextDisabled ?? false} compact={compact} label={t("ficheCalNext")} />
      </div>
      <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {weekdays.map((weekday, index) => (
          <span key={index} style={{ textAlign: "center", fontSize: headFont, fontWeight: 700, color: "#9A958C" }}>
            {weekday}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((cell, index) => {
          if (cell.empty) return <span key={index} style={{ aspectRatio: "1" }} />;
          const endpoint = cell.isStart || cell.isEnd;
          let cellBg = "transparent";
          let cellRadius = "0";
          if (cell.inRange) cellBg = "#F1ECE6";
          if (endpoint) {
            cellBg = "#F1ECE6";
            if (cell.isStart && cell.isEnd) cellRadius = "50%";
            else cellRadius = cell.isStart ? "50% 0 0 50%" : "0 50% 50% 0";
          }
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                onSelect(cell.day);
              }}
              disabled={cell.disabled}
              aria-pressed={endpoint}
              aria-label={`${String(cell.day)} ${label}${cell.booked ? ` (${t("unavailable")})` : ""}`}
              title={cell.booked ? t("unavailable") : undefined}
              style={{
                aspectRatio: "1",
                border: "none",
                background: cell.booked ? "#F4F1ED" : cellBg,
                borderRadius: cell.booked ? "50%" : cellRadius,
                padding: 0,
                cursor: cell.disabled ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "90%",
                  height: "90%",
                  borderRadius: "50%",
                  background: endpoint ? "#231F1C" : "transparent",
                  color: endpoint ? "#fff" : cell.booked ? "#A8A29B" : cell.disabled ? "#CFC9C1" : "#231F1C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize,
                  fontWeight: endpoint ? 700 : 500,
                  textDecoration: cell.disabled ? "line-through" : "none",
                }}
              >
                {cell.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
