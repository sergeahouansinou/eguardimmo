"use client";

import { useQuery } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerUnit } from "./model";
import { fetchProperty, fetchPropertiesPage } from "./requests";

export function useProperties(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerUnit>(listKey("properties", agency), (cursor) => fetchPropertiesPage(client, agency, cursor), enabled);
}

export function useProperty(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("property", id), queryFn: () => fetchProperty(client, id) });
}
