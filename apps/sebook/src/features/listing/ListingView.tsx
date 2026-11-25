import { notFound } from "next/navigation";
import AnnonceDetail from "@/components/roost/AnnonceDetail";
import { Unavailable } from "@/components/roost/annonce/Unavailable";
import { sebookEnv } from "@/lib/env";
import { listingJsonLd } from "@/marketplace/jsonld";
import { JsonLdScript } from "@/marketplace/JsonLdScript";
import { searchFromParams } from "@/marketplace/search";
import { getListing } from "./getListing";
import { listingPath } from "./listingMetadata";

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

export async function ListingView({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<RawParams> }) {
  const { ref } = await params;
  const search = searchFromParams(await searchParams);
  const result = await getListing(ref);
  if (result.status === "absent") notFound();
  if (result.status === "unavailable") return <Unavailable />;
  const listing = result.value;
  const pageUrl = `${sebookEnv().siteUrl}${listingPath(listing.public_ref)}`;
  return (
    <>
      <JsonLdScript data={listingJsonLd(listing, pageUrl)} />
      <AnnonceDetail detail={listing} initial={{ checkIn: search.checkIn, checkOut: search.checkOut, guests: search.guests }} />
    </>
  );
}
