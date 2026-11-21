"use client";

import { useQuery } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerTaxStatement } from "./model";
import { fetchTaxStatement, fetchTaxStatementsPage } from "./requests";

export function useTaxStatements(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerTaxStatement>(listKey("taxStatements", agency), (cursor) => fetchTaxStatementsPage(client, agency, cursor), enabled);
}

export function useTaxStatement(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("taxStatement", id), queryFn: () => fetchTaxStatement(client, id) });
}
