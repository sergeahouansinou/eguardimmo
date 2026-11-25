"use client";

import { useT } from "@/lib/i18n/context";
import { formatMinor } from "@/lib/money";
import { describeFailure } from "@/marketplace/errors";
import type { Quote } from "@/marketplace/schemas";
import type { StayState } from "./useStay";
import { BODY_TEXT, INK, MUTED } from "./ui";

function Line({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: strong ? 16 : 15, fontWeight: strong ? 700 : 400, color: strong ? INK : BODY_TEXT }}>
      <span>{label}</span>
      <span>{amount}</span>
    </div>
  );
}

function Lines({ quote }: { quote: Quote }) {
  const t = useT();
  const money = (minor: number) => formatMinor(minor, quote.currency);
  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 13 }}>
      <Line label={`${money(quote.nightly_minor)} × ${String(quote.nights)} ${quote.nights > 1 ? t("nightsWord") : t("nightWord")}`} amount={money(quote.subtotal_minor)} />
      <Line label={t("ficheServiceFee")} amount={money(quote.service_fee_minor)} />
      <div style={{ height: 1, background: "#EFEBE6", margin: "2px 0" }} />
      <Line label={t("totalWord")} amount={money(quote.total_minor)} strong />
    </div>
  );
}

export function QuoteSection({ stay }: { stay: StayState }) {
  const t = useT();
  const { quote } = stay;
  let body;
  if (!stay.quoteRequested) body = null;
  else if (quote.isError) body = <p role="alert" style={{ fontSize: 14, color: "#C0392B", margin: "16px 0 0" }}>{describeFailure(quote.error).message}</p>;
  else if (quote.isPending) body = <p style={{ fontSize: 14, color: MUTED, margin: "16px 0 0" }}>{t("ficheQuoteLoading")}</p>;
  else if (!quote.data.available) body = <p style={{ fontSize: 14, color: "#C0392B", margin: "16px 0 0" }}>{t("ficheDatesUnavailable")}</p>;
  else body = <Lines quote={quote.data} />;
  return <div aria-live="polite">{body}</div>;
}
