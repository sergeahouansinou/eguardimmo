"use client";

import { nightsBetween } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/context";
import { FONTS } from "@/lib/roost-data";
import { describeFailure } from "@/marketplace/errors";
import BookingOutcome from "./reservation/BookingOutcome";
import CheckoutNotice from "./reservation/CheckoutNotice";
import PaymentCard from "./reservation/PaymentCard";
import ReservationHeader from "./reservation/ReservationHeader";
import StayCard from "./reservation/StayCard";
import SummaryAside from "./reservation/SummaryAside";
import { UI } from "./reservation/styles";
import { useCheckout } from "./reservation/useCheckout";
import { SkelBlock, SkelRegion } from "./Skeleton";

export default function Reservation({ publicRef }: { publicRef: string }) {
  const { t } = useI18n();
  const checkout = useCheckout(publicRef);
  const { listing, detail, stay, quote, booking } = checkout;
  const listingHref = `/listings/${publicRef}`;
  const home = { label: t("rsv_home"), href: "/" };

  const body = (() => {
    if (booking) return <BookingOutcome booking={booking} listingHref={listingHref} />;
    if (listing.isPending) {
      return (
        <main style={{ maxWidth: 1120, margin: "0 auto", padding: "34px 24px 90px" }}>
          <SkelRegion label={t("rsv_loadingListing")}>
            <SkelBlock style={{ height: 36, width: 280, marginBottom: 30 }} />
            <SkelBlock style={{ height: 260, maxWidth: 620, borderRadius: 18 }} />
          </SkelRegion>
        </main>
      );
    }
    if (!detail) {
      const failure = describeFailure(listing.error);
      return failure.kind === "notFound" ? (
        <CheckoutNotice title={t("rsv_goneTitle")} text={t("rsv_goneText")} actions={[home]} />
      ) : (
        <CheckoutNotice title={t("rsv_errorTitle")} text={failure.message} actions={[{ label: t("rsv_retry"), onClick: () => void listing.refetch() }, home]} />
      );
    }
    if (detail.kind !== "short_stay") {
      return <CheckoutNotice title={t("rsv_longTermTitle")} text={t("rsv_longTermText")} actions={[{ label: t("rsv_backToListing"), href: listingHref }]} />;
    }
    if (!stay) {
      return <CheckoutNotice title={t("rsv_missingStayTitle")} text={t("rsv_missingStayText")} actions={[{ label: t("rsv_backToListing"), href: listingHref }]} />;
    }
    return (
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "34px 24px 90px" }}>
        <h1 style={{ fontFamily: UI, fontWeight: 700, fontSize: "clamp(24px, 4vw, 30px)", lineHeight: 1.2, letterSpacing: "-0.02em", color: "#231F1C", margin: "0 0 30px" }}>
          {t("rsv_pageHeading")}
        </h1>
        <div className="r-resa-cols" style={{ display: "flex", gap: 64, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 620, display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
            <StayCard title={detail.title} stay={stay} />
            <PaymentCard checkout={checkout} listingHref={listingHref} />
          </div>
          <SummaryAside detail={detail} stay={stay} quote={quote} nights={nightsBetween(stay.checkIn, stay.checkOut)} listingHref={listingHref} />
        </div>
      </main>
    );
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <ReservationHeader backHref={booking ? null : listingHref} />
      {body}
    </div>
  );
}
