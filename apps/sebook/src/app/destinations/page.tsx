import type { Metadata } from "next";
import { Suspense } from "react";
import { DestinationsView } from "@/features/destinations/DestinationsView";
import { destinationsMetadata, placeNameFrom } from "@/features/destinations/destinationsMetadata";
import { searchFromParams } from "@/marketplace/search";
import { fetchListings } from "@/marketplace/server";
import Loading from "../loading";

export async function generateMetadata({ searchParams }: PageProps<"/destinations">): Promise<Metadata> {
  const search = searchFromParams(await searchParams);
  const result = await fetchListings(search);
  return destinationsMetadata(search, result.status === "found" ? placeNameFrom(search, result.value.items) : null);
}

async function Results({ searchParams }: { searchParams: PageProps<"/destinations">["searchParams"] }) {
  return <DestinationsView search={searchFromParams(await searchParams)} />;
}

export default function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  return (
    <Suspense fallback={<Loading />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
