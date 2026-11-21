"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { detailKey } from "../keys";
import { fetchFile } from "../shared/download";
import { useOwnerSession } from "../session";
import { reportPdfPath } from "./requests";

export function useReportPdf(id: string) {
  const { client } = useOwnerSession();
  const query = useQuery({
    queryKey: detailKey("report-pdf", id),
    queryFn: () => fetchFile(client, reportPdfPath(id), "pdf"),
    gcTime: 0,
    staleTime: Infinity,
  });
  const blob = query.data;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blob === undefined) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);
  return { query, blob, url };
}
