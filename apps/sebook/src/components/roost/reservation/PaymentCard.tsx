"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { ACCENT } from "@/lib/roost-data";
import type { Checkout } from "./useCheckout";
import { alertStyle, cardStyle, h2Style, noticeStyle, underlineLinkStyle } from "./styles";

export default function PaymentCard({ checkout, listingHref }: { checkout: Checkout; listingHref: string }) {
  const { t } = useI18n();
  const { accepted, setAccepted, problem, failure, unverified, verifyHref, canSubmit, confirm, submit, quote, quoteAvailable } = checkout;
  const datesGone = failure?.kind === "datesUnavailable" || (quote.isSuccess && !quoteAvailable);
  const showFailure = failure !== null && failure.kind !== "unverified" && failure.kind !== "datesUnavailable";
  const disabled = !canSubmit;
  const hasMessage = datesGone || showFailure || unverified || problem !== null;
  return (
    <section style={cardStyle} aria-labelledby="rsv-pay-title">
      <h2 id="rsv-pay-title" style={{ ...h2Style, marginBottom: 14 }}>
        {t("rsv_payTitle")}
      </h2>
      <p style={{ fontSize: 14.5, color: "#3F3A35", lineHeight: 1.55, margin: 0 }}>{t("rsv_payNote")}</p>

      <label
        htmlFor="rsv-accept"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 11,
          marginTop: 18,
          padding: "14px 16px",
          border: `1.5px solid ${accepted ? ACCENT : "#E2DDD6"}`,
          borderRadius: 13,
          background: accepted ? "#FBF7F2" : "#fff",
          cursor: "pointer",
          transition: "border-color .15s ease, background .15s ease",
        }}
      >
        <input
          id="rsv-accept"
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked);
          }}
          style={{ width: 20, height: 20, marginTop: 1, accentColor: ACCENT, flex: "0 0 auto", cursor: "pointer" }}
        />
        <span style={{ fontSize: 13.5, color: "#3F3A35", lineHeight: 1.5 }}>{t("rsv_accept")}</span>
      </label>

      <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: hasMessage ? 14 : 0 }}>
        {problem ? (
          <div role="alert" style={alertStyle}>
            {t(problem.key, { n: problem.n })}
          </div>
        ) : null}
        {datesGone ? (
          <div role="alert" style={alertStyle}>
            <strong>{t("rsv_datesUnavailableTitle")}</strong> {t("rsv_datesUnavailableText")}{" "}
            <Link href={listingHref} style={underlineLinkStyle}>
              {t("rsv_changeDates")}
            </Link>
          </div>
        ) : null}
        {showFailure ? (
          <div role="alert" style={alertStyle}>
            <strong>{t("rsv_failedTitle")}</strong> {failure.message}
          </div>
        ) : null}
        {unverified ? (
          <div role="alert" style={noticeStyle}>
            <strong>{t("rsv_verifyTitle")}</strong> {t("rsv_verifyText")}
            {verifyHref ? (
              <>
                {" "}
                <a href={verifyHref} style={underlineLinkStyle}>
                  {t("rsv_verifyLink")}
                </a>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="r-reserve"
        onClick={confirm}
        disabled={disabled}
        style={{
          width: "100%",
          marginTop: 20,
          background: ACCENT,
          color: "#fff",
          border: "none",
          borderRadius: 13,
          padding: 16,
          minHeight: 52,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          opacity: disabled ? 0.5 : 1,
          transition: "opacity .15s ease",
        }}
      >
        {submit.isPending ? t("rsv_submitting") : t("rsv_submit")}
      </button>
    </section>
  );
}
