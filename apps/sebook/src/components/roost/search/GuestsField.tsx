"use client";

import { useI18n } from "@/lib/i18n/context";
import { MAX_GUESTS } from "./useSearchForm";
import { INK, PLACEHOLDER } from "./styles";

const stepper = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "1px solid #C9C3BA",
  background: "#fff",
  cursor: "pointer",
  color: INK,
  fontSize: 20,
  lineHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

export function GuestsField({ guests, onChange }: { guests: number; onChange: (guests: number) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>{t("sbGuests")}</div>
        <div style={{ fontSize: 13, color: PLACEHOLDER }}>{t("sbGuestsSub")}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <button
          type="button"
          className="r-hover-border"
          aria-label={t("sbGuestsLess")}
          disabled={guests <= 0}
          onClick={() => {
            onChange(guests - 1);
          }}
          style={{ ...stepper, opacity: guests <= 0 ? 0.35 : 1 }}
        >
          −
        </button>
        <span aria-live="polite" style={{ minWidth: 18, textAlign: "center", fontSize: 15, fontWeight: 600, color: INK }}>
          {guests}
        </span>
        <button
          type="button"
          className="r-hover-border"
          aria-label={t("sbGuestsMore")}
          disabled={guests >= MAX_GUESTS}
          onClick={() => {
            onChange(guests + 1);
          }}
          style={{ ...stepper, opacity: guests >= MAX_GUESTS ? 0.35 : 1 }}
        >
          +
        </button>
      </div>
    </div>
  );
}
