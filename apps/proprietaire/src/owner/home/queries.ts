"use client";

import { useQuery } from "@tanstack/react-query";
import { homeKey } from "../keys";
import { useOwnerSession } from "../session";
import { fetchHome } from "./requests";

export function useOwnerHome(agency: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: homeKey(agency), queryFn: () => fetchHome(client, agency) });
}
