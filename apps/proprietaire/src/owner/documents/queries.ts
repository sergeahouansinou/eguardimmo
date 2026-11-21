"use client";

import { listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerDocument } from "./model";
import { fetchDocumentsPage } from "./requests";

export function useDocuments(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerDocument>(listKey("documents", agency), (cursor) => fetchDocumentsPage(client, agency, cursor), enabled);
}
