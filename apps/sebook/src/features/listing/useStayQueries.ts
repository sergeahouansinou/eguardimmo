"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/session/SessionProvider";
import { addDays } from "@/lib/dates";
import { sebookKeys } from "@/marketplace/keys";
import { fetchAvailability, requestQuote } from "@/marketplace/requests";

export function useAvailability(ref: string, today: string, enabled: boolean) {
  const { client } = useSession();
  const to = today ? addDays(today, 365) : "";
  return useQuery({ queryKey: sebookKeys.availability(ref, today, to), queryFn: () => fetchAvailability(client, ref, today, to), enabled: enabled && today !== "" });
}

export function useQuote(ref: string, stay: { checkIn: string; checkOut: string; guests: number }, enabled: boolean) {
  const { client } = useSession();
  return useQuery({
    queryKey: sebookKeys.quote(ref, stay.checkIn, stay.checkOut, stay.guests),
    queryFn: () => requestQuote(client, ref, stay),
    enabled,
  });
}
