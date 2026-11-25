"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { newClientId } from "@/features/checkout/clientId";
import { staySignature, stayFromParams } from "@/features/checkout/checkoutForm";
import { useQuote } from "@/features/listing/useStayQueries";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, verifyEmailHref } from "@/features/session/signIn";
import { useAuth } from "@/lib/auth";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { useToday } from "@/lib/useToday";
import { describeFailure } from "@/marketplace/errors";
import type { Failure } from "@/marketplace/errors";
import { sebookKeys } from "@/marketplace/keys";
import { createBooking, fetchListingDetail } from "@/marketplace/requests";
import type { Booking, ListingDetail } from "@/marketplace/schemas";
import { checkStay } from "@/marketplace/stay";
import type { StayProblem } from "@/marketplace/stay";

const PROBLEM_KEYS: Partial<Record<StayProblem, I18nKey>> = {
  past: "rsv_problemPast",
  order: "rsv_problemOrder",
  minNights: "errMinStay",
  guests: "rsv_problemGuests",
};

function problemOf(problem: StayProblem, detail: ListingDetail): { key: I18nKey; n: number } | null {
  const key = PROBLEM_KEYS[problem];
  if (!key) return null;
  return { key, n: problem === "guests" ? detail.capacity : (detail.min_nights ?? 0) };
}

export function useCheckout(publicRef: string) {
  const { client, authUrl } = useSession();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, loading: authLoading, openAuth } = useAuth();
  const stay = stayFromParams(useSearchParams());
  const today = useToday();
  const [accepted, setAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const listing = useQuery({ queryKey: sebookKeys.listing(publicRef), queryFn: () => fetchListingDetail(client, publicRef) });
  const detail = listing.data;
  const bookable = detail?.kind === "short_stay" && stay !== null;

  const check =
    detail && stay && today !== ""
      ? checkStay({ ...stay, capacity: detail.capacity, minNights: detail.min_nights, occupied: [], today })
      : null;
  const problem = detail && check && !check.ok ? problemOf(check.problem, detail) : null;
  const stayValid = bookable && check?.ok === true;

  const quote = useQuote(publicRef, stay ?? { checkIn: "", checkOut: "", guests: 1 }, stayValid);

  const submit = useMutation({
    mutationFn: () => {
      if (!stay) throw new Error("Séjour manquant.");
      const signature = staySignature(publicRef, stay);
      if (attempt.current?.signature !== signature) attempt.current = { signature, key: newClientId() };
      return createBooking(client, { listingRef: publicRef, ...stay, idempotencyKey: attempt.current.key });
    },
    onSuccess: (created) => {
      setBooking(created);
      void queryClient.invalidateQueries({ queryKey: sebookKeys.bookings });
    },
    onError: (error) => {
      if (describeFailure(error).kind === "unauthenticated") openAuth("login");
    },
  });

  const failure: Failure | null = submit.isError ? describeFailure(submit.error) : null;
  const unverified = (user !== null && !user.verified) || failure?.kind === "unverified";
  const verifyHref = unverified ? verifyEmailHref(authUrl, currentPageUrl()) : null;
  const quoteAvailable = quote.isSuccess && quote.data.available;
  const canSubmit = accepted && stayValid && quoteAvailable && !authLoading && !unverified && !submit.isPending;

  const confirm = () => {
    if (!canSubmit) return;
    if (!isAuthenticated) {
      openAuth("login");
      return;
    }
    submit.mutate();
  };

  return { listing, detail, stay, problem, quote, quoteAvailable, accepted, setAccepted, booking, submit, failure, unverified, verifyHref, canSubmit, confirm, authLoading };
}

export type Checkout = ReturnType<typeof useCheckout>;
