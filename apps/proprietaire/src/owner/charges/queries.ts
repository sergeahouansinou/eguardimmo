"use client";

import { useQuery } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerStatement } from "./model";
import { fetchStatement, fetchStatementsPage } from "./requests";

export function useStatements(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerStatement>(listKey("chargeStatements", agency), (cursor) => fetchStatementsPage(client, agency, cursor), enabled);
}

export function useStatement(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("charge-statement", id), queryFn: () => fetchStatement(client, id) });
}
