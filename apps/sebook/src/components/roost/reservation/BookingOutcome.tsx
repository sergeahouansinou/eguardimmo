"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { OUTCOME_KEYS } from "@/features/checkout/bookingLabels";
import { formatDateTime, formatDayLong, guestsText } from "@/features/checkout/stayFormat";
import { useI18n } from "@/lib/i18n/context";
import { formatMinor } from "@/lib/money";
import { ACCENT } from "@/lib/roost-data";
import type { Booking } from "@/marketplace/schemas";
import { NAVY, UI, cardStyle, h2Style, mutedStyle, recapRowStyle, strongStyle } from "./styles";

function Icon({ status }: { status: Booking["status"] }) {
  const confirmed = status === "confirmed";
  return (
    <div aria-hidden="true" style={{ width: 74, height: 74, borderRadius: "50%", background: confirmed ? ACCENT : "#F2A33A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
      <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        {confirmed ? <path d="M20 6L9 17l-5-5" /> : <path d="M12 6v6l4 2" />}
      </svg>
    </div>
  );
}

export default function BookingOutcome({ booking, listingHref }: { booking: Booking; listingHref: string }) {
  const { t, lang } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const keys = OUTCOME_KEYS[booking.status];
  const rows: [string, string][] = [
    [t("rsv_rowListing"), booking.listing?.title ?? t("bk_listingUnavailable")],
    [t("rsv_rowDates"), `${formatDayLong(booking.check_in, lang)} → ${formatDayLong(booking.check_out, lang)}`],
    [t("rsv_rowGuests"), guestsText(t, booking.guests)],
    [t("rsv_total"), formatMinor(booking.total_minor, booking.currency)],
  ];

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 24px 90px" }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <Icon status={booking.status} />
        <h1 ref={heading} tabIndex={-1} style={{ fontFamily: UI, fontWeight: 800, fontSize: "clamp(24px, 4vw, 30px)", letterSpacing: "-0.02em", margin: "0 0 10px", color: "#231F1C", outline: "none" }}>
          {t(keys.title)}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "#6E6A66", margin: 0 }}>{t(keys.text)}</p>
        {booking.status === "pending_payment" && booking.expires_at ? (
          <p style={{ fontSize: 14, color: "#8A5A00", margin: "10px 0 0" }}>{t("rsv_outHold", { date: formatDateTime(booking.expires_at, lang) })}</p>
        ) : null}
      </div>

      <div style={{ background: "#F7F5F2", borderRadius: 14, padding: "18px 20px", textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6E6A66", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("rsv_outReference")}</div>
        <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 24, letterSpacing: "0.01em", color: "#231F1C", marginTop: 6 }}>{booking.reference}</div>
      </div>

      <section style={{ ...cardStyle, marginBottom: 28 }} aria-labelledby="rsv-out-recap">
        <h2 id="rsv-out-recap" style={{ ...h2Style, marginBottom: 18 }}>
          {t("rsv_outRecap")}
        </h2>
        <dl style={{ display: "flex", flexDirection: "column", gap: 14, margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={recapRowStyle}>
              <dt style={mutedStyle}>{label}</dt>
              <dd style={{ ...strongStyle, margin: 0 }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/compte" className="r-show-more" style={{ display: "block", textAlign: "center", background: NAVY, color: "#fff", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
          {t("rsv_outSeeBookings")}
        </Link>
        <Link href={listingHref} className="r-hover-soft" style={{ display: "block", textAlign: "center", background: "#F4F1ED", color: "#231F1C", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          {t("rsv_outBackToListing")}
        </Link>
      </div>
    </main>
  );
}
