"use client";

import { useQuery } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerInvoice } from "./model";
import { fetchInvoice, fetchInvoicesPage } from "./requests";

export function useInvoices(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerInvoice>(listKey("invoices", agency), (cursor) => fetchInvoicesPage(client, agency, cursor), enabled);
}

export function useInvoice(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("invoice", id), queryFn: () => fetchInvoice(client, id) });
}
