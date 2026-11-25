"use client";

import { useT } from "@/lib/i18n/context";
import { INK, MUTED } from "./ui";

export const fieldLabelStyle = { fontSize: 10, fontWeight: 800, letterSpacing: ".04em", color: INK } as const;

export function GuestsButton({ guests, open, controls, onToggle }: { guests: number; open: boolean; controls: string; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "none",
        padding: "11px 14px",
        minHeight: 44,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>
        <span style={{ display: "block", ...fieldLabelStyle }}>{t("bcGuests")}</span>
        <span style={{ display: "block", fontSize: 14, color: INK, marginTop: 2 }}>{`${String(guests)} ${guests > 1 ? t("guestsWord") : t("guestWordOne")}`}</span>
      </span>
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function Step({ sign, label, enabled, onClick }: { sign: "−" | "+"; label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: `1px solid ${enabled ? "#9A958C" : "#EAE5DE"}`,
        background: "#fff",
        cursor: enabled ? "pointer" : "default",
        color: enabled ? INK : "#D6D0C8",
        fontSize: 18,
        lineHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span aria-hidden="true">{sign}</span>
    </button>
  );
}

export function GuestsPopover({ id, guests, capacity, onChange }: { id: string; guests: number; capacity: number; onChange: (guests: number) => void }) {
  const t = useT();
  return (
    <div
      id={id}
      role="group"
      aria-label={t("bcGuests")}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        zIndex: 30,
        background: "#fff",
        border: "1px solid #E5E0D9",
        borderRadius: 14,
        boxShadow: "0 14px 34px rgba(0,0,0,.16)",
        padding: "6px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>{t("ficheTravellers")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <Step
            sign="−"
            label={t("ficheRemoveGuest")}
            enabled={guests > 1}
            onClick={() => {
              onChange(guests - 1);
            }}
          />
          <output aria-live="polite" style={{ minWidth: 14, textAlign: "center", fontSize: 15, fontWeight: 600 }}>
            {guests}
          </output>
          <Step
            sign="+"
            label={t("ficheAddGuest")}
            enabled={guests < capacity}
            onClick={() => {
              onChange(guests + 1);
            }}
          />
        </div>
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px" }}>{t("maxGuestsNote", { n: capacity })}</p>
    </div>
  );
}
