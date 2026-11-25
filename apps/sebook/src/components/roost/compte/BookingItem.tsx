"use client";

import Link from "next/link";
import { POLICY_KEYS, STATUS_KEYS, STATUS_TONES } from "@/features/checkout/bookingLabels";
import { formatDayLong, guestsText, isPast } from "@/features/checkout/stayFormat";
import { useI18n } from "@/lib/i18n/context";
import { formatMinor } from "@/lib/money";
import { GRADIENTS } from "@/lib/roost-data";
import { sceneFromRef } from "@/marketplace/roost";
import type { Booking } from "@/marketplace/schemas";

export function canCancel(booking: Booking, today: string): boolean {
  return today !== "" && (booking.status === "pending_payment" || booking.status === "confirmed") && booking.check_in > today;
}

interface BookingItemProps {
  booking: Booking;
  today: string;
  now: Date | null;
  onCancel: (booking: Booking) => void;
}

export default function BookingItem({ booking, today, now, onCancel }: BookingItemProps) {
  const { t, lang } = useI18n();
  const tone = STATUS_TONES[booking.status];
  const policy = POLICY_KEYS[booking.cancellation_policy];
  const scene = sceneFromRef(booking.listing?.public_ref ?? booking.reference);
  const holdExpired = booking.status === "pending_payment" && booking.expires_at !== null && now !== null && isPast(booking.expires_at, now);
  const meta = [`${formatDayLong(booking.check_in, lang)} → ${formatDayLong(booking.check_out, lang)}`, guestsText(t, booking.guests), booking.listing?.host?.name].filter(Boolean).join(" · ");
  const note = { fontSize: 13, color: "#6E6A66", margin: 0, lineHeight: 1.5 } as const;

  return (
    <article style={{ display: "flex", flexWrap: "wrap", overflow: "hidden", border: "1px solid #E5E0D9", borderRadius: 18, background: "#fff" }}>
      <div aria-hidden="true" style={{ flex: "0 0 160px", minHeight: 120, background: GRADIENTS[scene] }} />
      <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6, padding: "18px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{ background: tone.background, color: tone.color, borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>{t(STATUS_KEYS[booking.status])}</span>
          <span style={{ fontSize: 13, color: "#8A8580" }}>{booking.reference}</span>
        </div>
        <h3 style={{ fontFamily: "var(--font-schibsted), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", margin: 0, color: "#231F1C", overflowWrap: "anywhere" }}>
          {booking.listing ? (
            <Link href={`/listings/${booking.listing.public_ref}`} className="r-hover-underline" style={{ color: "inherit", textDecoration: "none" }}>
              {booking.listing.title}
            </Link>
          ) : (
            t("bk_listingUnavailable")
          )}
        </h3>
        <p style={{ fontSize: 14.5, color: "#3F3A35", margin: 0, lineHeight: 1.5 }}>{meta}</p>
        {booking.status === "pending_payment" ? <p style={{ ...note, color: "#8A5A00" }}>{holdExpired ? t("acc_holdExpired") : t("acc_pendingNote")}</p> : null}
        {booking.status === "cancelled" && booking.refund_minor !== null ? <p style={note}>{t("acc_refund", { amount: formatMinor(booking.refund_minor, booking.currency) })}</p> : null}
        <p style={note}>{t("acc_policy", { name: t(policy.name) })}</p>
        <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <strong style={{ fontSize: 18, color: "#231F1C" }}>{formatMinor(booking.total_minor, booking.currency)}</strong>
          {canCancel(booking, today) ? (
            <button
              type="button"
              className="r-hover-soft"
              aria-label={t("acc_cancelAria", { ref: booking.reference })}
              onClick={() => {
                onCancel(booking);
              }}
              style={{ background: "#fff", color: "#B42318", border: "1px solid #F4C7C7", borderRadius: 11, padding: "10px 18px", minHeight: 44, fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
            >
              {t("acc_cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
