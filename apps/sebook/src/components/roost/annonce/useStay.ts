"use client";

import { useMemo, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useAvailability, useQuote } from "@/features/listing/useStayQueries";
import { addDaysToParts, bookedNightKeys, isoOfParts, nightsBetween, partsOfIso, selectDay } from "@/lib/calendar";
import type { DateParts } from "@/lib/calendar";
import { useToday } from "@/lib/useToday";
import type { AnnonceView } from "@/marketplace/roostDetail";
import type { OccupiedRange, Quote } from "@/marketplace/schemas";
import { checkStay, reservationHref } from "@/marketplace/stay";
import type { StayProblem } from "@/marketplace/stay";

export const AVAILABILITY_WINDOW_DAYS = 365;

export interface StayInitial {
  checkIn: string;
  checkOut: string;
  guests: number | null;
}

export interface StayState {
  enabled: boolean;
  today: DateParts | null;
  lastDay: DateParts | null;
  checkIn: DateParts | null;
  checkOut: DateParts | null;
  guests: number;
  setGuests: (guests: number) => void;
  pick: (y: number, m: number, d: number) => void;
  blocked: ReadonlySet<number>;
  occupied: readonly OccupiedRange[];
  minNights: number;
  nights: number;
  problem: StayProblem | null;
  availabilityFailed: boolean;
  quote: UseQueryResult<Quote>;
  quoteRequested: boolean;
  reserveHref: string | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function useStay(view: Pick<AnnonceView, "ref" | "kind" | "capacity" | "minNights">, initial: StayInitial): StayState {
  const enabled = view.kind === "short_stay";
  const todayIso = useToday();
  const [checkIn, setCheckIn] = useState<DateParts | null>(() => (enabled ? partsOfIso(initial.checkIn) : null));
  const [checkOut, setCheckOut] = useState<DateParts | null>(() => (enabled ? partsOfIso(initial.checkOut) : null));
  const [guests, setGuests] = useState(() => clamp(initial.guests ?? 1, 1, view.capacity));

  const today = useMemo(() => (todayIso ? partsOfIso(todayIso) : null), [todayIso]);
  const lastDay = useMemo(() => (today ? addDaysToParts(today, AVAILABILITY_WINDOW_DAYS) : null), [today]);

  const availability = useAvailability(view.ref, todayIso, enabled);
  const occupied = useMemo(() => availability.data ?? [], [availability.data]);
  const blocked = useMemo(() => bookedNightKeys(occupied.map((range) => ({ checkIn: range.from, checkOut: range.to }))), [occupied]);

  const minNights = view.minNights ?? 1;
  const checkInIso = checkIn ? isoOfParts(checkIn) : "";
  const checkOutIso = checkOut ? isoOfParts(checkOut) : "";
  const check = checkStay({
    checkIn: checkInIso,
    checkOut: checkOutIso,
    guests,
    capacity: view.capacity,
    minNights: view.minNights,
    occupied,
    today: todayIso,
  });
  const quoteRequested = enabled && todayIso !== "" && check.ok && !availability.isPending;
  const quote = useQuote(view.ref, { checkIn: checkInIso, checkOut: checkOutIso, guests }, quoteRequested);

  const pick = (y: number, m: number, d: number) => {
    const next = selectDay(checkIn, checkOut, y, m, d, { blocked, minNights });
    setCheckIn(next.checkIn);
    setCheckOut(next.checkOut);
  };

  return {
    enabled,
    today,
    lastDay,
    checkIn,
    checkOut,
    guests,
    setGuests: (next) => {
      setGuests(clamp(next, 1, view.capacity));
    },
    pick,
    blocked,
    occupied,
    minNights,
    nights: nightsBetween(checkIn, checkOut),
    problem: check.ok || check.problem === "incomplete" ? null : check.problem,
    availabilityFailed: availability.isError,
    quote,
    quoteRequested,
    reserveHref: check.ok ? reservationHref(view.ref, { checkIn: checkInIso, checkOut: checkOutIso, guests }) : null,
  };
}
