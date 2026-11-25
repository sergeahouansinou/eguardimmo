"use client";

import Link from "next/link";
import type { Stay } from "@/features/checkout/checkoutForm";
import { POLICY_KEYS } from "@/features/checkout/bookingLabels";
import { formatDayLong, guestsText, nightsText } from "@/features/checkout/stayFormat";
import { useI18n } from "@/lib/i18n/context";
import { formatMinor } from "@/lib/money";
import { GRADIENTS } from "@/lib/roost-data";
import { describeFailure } from "@/marketplace/errors";
import { placeLine } from "@/marketplace/format";
import { sceneFromRef } from "@/marketplace/roost";
import type { ListingDetail } from "@/marketplace/schemas";
import type { Checkout } from "./useCheckout";
import { UI, alertStyle, mutedStyle, softLinkStyle } from "./styles";

function InfoRow({ label, value, href, action }: { label: string; value: string; href: string; action: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 0", borderBottom: "1px solid #EFEBE6" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#231F1C", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14, color: "#6E6A66" }}>{value}</div>
      </div>
      <Link href={href} className="r-hover-soft" style={softLinkStyle}>
        {action}
      </Link>
    </div>
  );
}

function PriceDetail({ quote, nights }: { quote: Checkout["quote"]; nights: number }) {
  const { t } = useI18n();
  if (quote.isPending && quote.fetchStatus === "idle") return null;
  if (quote.isPending) return <p style={{ ...mutedStyle, fontSize: 14, margin: 0 }}>{t("rsv_priceLoading")}</p>;
  if (quote.isError) {
    return (
      <div role="alert" style={alertStyle}>
        <strong>{t("rsv_priceErrorTitle")}</strong> {describeFailure(quote.error).message}
      </div>
    );
  }
  const { data } = quote;
  const line = (label: string, amount: number, bold = false) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, fontSize: bold ? 16 : 15, fontWeight: bold ? 700 : 400, color: bold ? "#231F1C" : "#3F3A35" }}>
      <span>{label}</span>
      <span>{formatMinor(amount, data.currency)}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {line(t("rsv_priceLine", { price: formatMinor(data.nightly_minor, data.currency), nights: nightsText(t, nights) }), data.subtotal_minor)}
      {data.service_fee_minor > 0 ? line(t("rsv_serviceFee"), data.service_fee_minor) : null}
      <div style={{ height: 1, background: "#EFEBE6", margin: "4px 0" }} />
      {line(t("rsv_total"), data.total_minor, true)}
    </div>
  );
}

export default function SummaryAside({ detail, stay, quote, nights, listingHref }: { detail: ListingDetail; stay: Stay; quote: Checkout["quote"]; nights: number; listingHref: string }) {
  const { t, lang } = useI18n();
  const policy = POLICY_KEYS[detail.cancellation_policy];
  return (
    <aside className="r-resa-summary" aria-label={t("rsv_stayTitle")} style={{ flex: "0 0 372px", position: "sticky", top: 92 }}>
      <div style={{ border: "1px solid #E5E0D9", borderRadius: 18, boxShadow: "0 6px 22px rgba(40,40,40,.10)", padding: 24 }}>
        <div style={{ display: "flex", gap: 15, alignItems: "flex-start", paddingBottom: 22, borderBottom: "1px solid #EFEBE6" }}>
          <div aria-hidden="true" style={{ width: 104, height: 88, borderRadius: 12, overflow: "hidden", background: GRADIENTS[sceneFromRef(detail.public_ref)], flex: "0 0 auto" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: "#231F1C", overflowWrap: "anywhere" }}>{detail.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#6E6A66" }}>{[placeLine(detail), detail.host?.name].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <InfoRow label={t("rsv_rowDates")} value={`${formatDayLong(stay.checkIn, lang)} → ${formatDayLong(stay.checkOut, lang)}`} href={listingHref} action={t("rsv_modify")} />
        <InfoRow label={t("rsv_rowGuests")} value={guestsText(t, stay.guests)} href={listingHref} action={t("rsv_modify")} />
        <div style={{ paddingTop: 20 }} aria-live="polite">
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 17, color: "#231F1C", marginBottom: 14 }}>{t("rsv_priceTitle")}</div>
          <PriceDetail quote={quote} nights={nights} />
          <div style={{ marginTop: 14, fontSize: 13, color: "#8A8580", lineHeight: 1.5 }}>{t("rsv_priceFootnote")}</div>
        </div>
        <p style={{ margin: "18px 0 0", padding: 12, borderRadius: 10, background: "#F7F5F2", fontSize: 13, lineHeight: 1.5, color: "#3F3A35" }}>
          {t("rsv_policyLine", { name: t(policy.name), text: t(policy.text) })}
        </p>
      </div>
    </aside>
  );
}
