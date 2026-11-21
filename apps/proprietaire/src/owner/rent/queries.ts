"use client";

import { useQuery } from "@tanstack/react-query";
import { listKey, rentKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { Payout, PayoutsPage } from "./model";
import { fetchPayoutsPage, fetchRentMonth } from "./requests";

export function useRentMonth(month: string, agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: rentKey(month, agency), queryFn: () => fetchRentMonth(client, month, agency), enabled });
}

export function usePayouts(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<Payout, PayoutsPage>(listKey("payouts", agency), (cursor) => fetchPayoutsPage(client, agency, cursor), enabled);
}
