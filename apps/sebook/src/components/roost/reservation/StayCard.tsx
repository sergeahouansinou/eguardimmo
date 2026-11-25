"use client";

import { guestsText, formatDayLong, nightsText } from "@/features/checkout/stayFormat";
import type { Stay } from "@/features/checkout/checkoutForm";
import { nightsBetween } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/context";
import { cardStyle, h2Style, mutedStyle, recapRowStyle, strongStyle } from "./styles";

export default function StayCard({ title, stay }: { title: string; stay: Stay }) {
  const { t, lang } = useI18n();
  const rows: [string, string][] = [
    [t("rsv_rowListing"), title],
    [t("rsv_rowCheckIn"), formatDayLong(stay.checkIn, lang)],
    [t("rsv_rowCheckOut"), formatDayLong(stay.checkOut, lang)],
    [t("rsv_rowDuration"), nightsText(t, nightsBetween(stay.checkIn, stay.checkOut))],
    [t("rsv_rowGuests"), guestsText(t, stay.guests)],
  ];
  return (
    <section style={cardStyle} aria-labelledby="rsv-stay-title">
      <h2 id="rsv-stay-title" style={{ ...h2Style, marginBottom: 18 }}>
        {t("rsv_stayTitle")}
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
  );
}
