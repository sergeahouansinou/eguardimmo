import RoostDestination from "@/components/roost/RoostDestination";
import { toListing } from "@/marketplace/roost";
import type { SearchState } from "@/marketplace/search";
import { fetchListings } from "@/marketplace/server";
import { placeNameFrom } from "./destinationsMetadata";

export async function DestinationsView({ search }: { search: SearchState }) {
  const result = await fetchListings(search);
  if (result.status !== "found") return <RoostDestination search={search} listings={[]} nextCursor={null} status="unavailable" placeName={null} />;
  return <RoostDestination search={search} listings={result.value.items.map(toListing)} nextCursor={result.value.nextCursor} status="ready" placeName={placeNameFrom(search, result.value.items)} />;
}
