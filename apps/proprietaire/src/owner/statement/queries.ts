"use client";

import { useQuery } from "@tanstack/react-query";
import type { Period } from "@/features/confie/data/period";
import { statementKey } from "../keys";
import { useOwnerSession } from "../session";
import { fetchStatement } from "./requests";

export function useOwnerStatement(agency: string, period: Period, enabled: boolean) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: statementKey(agency, period.from, period.to), queryFn: () => fetchStatement(client, agency, period), enabled });
}
