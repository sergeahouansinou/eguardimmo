"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/session/SessionProvider";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { sebookKeys } from "@/marketplace/keys";
import { fetchPlaces } from "@/marketplace/requests";
import type { Place } from "@/marketplace/schemas";

export const PLACES_MIN_CHARS = 2;

export function placeLabel(place: Place): string {
  return place.postal_code ? `${place.name} (${place.postal_code})` : place.name;
}

export function usePlaces(text: string) {
  const { client } = useSession();
  const query = useDebouncedValue(text.trim().slice(0, 80), 250);
  const enabled = query.length >= PLACES_MIN_CHARS;
  const result = useQuery({ queryKey: sebookKeys.places(query), queryFn: () => fetchPlaces(client, query), enabled, staleTime: 300_000 });
  return { places: enabled ? (result.data ?? []) : [], loading: enabled && result.isFetching, failed: enabled && result.isError };
}
