"use client";

import { useState } from "react";
import { POLICY_KEYS } from "@/features/checkout/bookingLabels";
import { formatDayLong } from "@/features/checkout/stayFormat";
import { useBookings, useCancelBooking } from "@/features/account/queries";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, verifyEmailHref } from "@/features/session/signIn";
import { todayIso } from "@/lib/dates";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/context";
import { describeFailure } from "@/marketplace/errors";
import type { Booking } from "@/marketplace/schemas";
import { NAVY } from "../reservation/styles";
import { SkelBlock, SkelRegion } from "../Skeleton";
import BookingItem from "./BookingItem";
import CancelDialog from "./CancelDialog";
import PageNotice from "./PageNotice";
import { useNow } from "./useNow";

function BookingsSkeleton({ label }: { label: string }) {
  return (
    <SkelRegion label={label} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[0, 1, 2].map((index) => (
        <SkelBlock key={index} style={{ height: 150, borderRadius: 18 }} />
      ))}
    </SkelRegion>
  );
}

export default function BookingsList() {
  const { t, lang } = useI18n();
  const { authUrl } = useSession();
  const { openAuth } = useAuth();
  const bookings = useBookings();
  const [asked, setAsked] = useState<Booking | null>(null);
  const cancel = useCancelBooking(() => {
    setAsked(null);
  });
  const now = useNow();
  const today = now ? todayIso(now) : "";

  if (bookings.isPending) return <BookingsSkeleton label={t("acc_loadingBookings")} />;
  if (bookings.isError) {
    const failure = describeFailure(bookings.error);
    if (failure.kind === "unauthenticated") {
      return <PageNotice role="alert" text={t("acc_loginText")} action={{ label: t("acc_login"), onClick: () => { openAuth("login"); } }} />;
    }
    const verify = failure.kind === "unverified" ? verifyEmailHref(authUrl, currentPageUrl()) : null;
    return (
      <PageNotice
        role="alert"
        title={t("acc_errorTitle")}
        text={failure.message}
        action={verify ? { label: t("rsv_verifyLink"), href: verify } : { label: t("rsv_retry"), onClick: () => void bookings.refetch() }}
      />
    );
  }

  const items = bookings.data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <PageNotice title={t("acc_emptyTitle")} text={t("acc_emptyText")} action={{ label: t("acc_search"), href: "/" }} />;

  const policy = asked ? POLICY_KEYS[asked.cancellation_policy] : null;
  const description =
    asked && policy
      ? t("acc_dialogText", {
          title: asked.listing?.title ?? t("bk_listingUnavailable"),
          dates: `${formatDayLong(asked.check_in, lang)} → ${formatDayLong(asked.check_out, lang)}`,
          policy: t(policy.text),
        })
      : "";

  return (
    <>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((booking) => (
          <li key={booking.id}>
            <BookingItem booking={booking} today={today} now={now} onCancel={setAsked} />
          </li>
        ))}
      </ul>
      {bookings.hasNextPage ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
          <button
            type="button"
            className="r-show-more"
            disabled={bookings.isFetchingNextPage}
            onClick={() => void bookings.fetchNextPage()}
            style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", minHeight: 48, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: bookings.isFetchingNextPage ? "wait" : "pointer", opacity: bookings.isFetchingNextPage ? 0.7 : 1 }}
          >
            {bookings.isFetchingNextPage ? t("acc_loadingMore") : t("acc_more")}
          </button>
        </div>
      ) : null}
      {asked ? (
        <CancelDialog
          description={description}
          pending={cancel.isPending}
          onConfirm={() => {
            cancel.mutate(asked.id);
          }}
          onClose={() => {
            setAsked(null);
          }}
        />
      ) : null}
    </>
  );
}
