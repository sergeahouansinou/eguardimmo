"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/marketplace/requests";
import { shouldRetry } from "@/marketplace/errors";
import { sebookKeys } from "@/marketplace/keys";
import { useSession } from "./SessionProvider";

export function useMe() {
  const { client } = useSession();
  return useQuery({ queryKey: sebookKeys.me, queryFn: () => fetchMe(client), staleTime: 60_000, retry: shouldRetry });
}
