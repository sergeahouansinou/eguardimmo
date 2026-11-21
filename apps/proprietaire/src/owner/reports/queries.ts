"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerReport, OwnerReportDetail } from "./model";
import { fetchReport, fetchReportsPage, markReportRead } from "./requests";

export function useReports(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerReport>(listKey("reports", agency), (cursor) => fetchReportsPage(client, agency, cursor), enabled);
}

export function useReport(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("report", id), queryFn: () => fetchReport(client, id) });
}

export function useMarkReportRead() {
  const { client } = useOwnerSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markReportRead(client, id),
    onSuccess: (report) => {
      queryClient.setQueryData<OwnerReportDetail>(detailKey("report", report.id), (current) => (current === undefined ? current : { ...current, firstReadAt: report.firstReadAt }));
    },
  });
}
