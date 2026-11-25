import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnonceSkeleton } from "@/components/roost/annonce/AnnonceSkeleton";
import Footer from "@/components/roost/Footer";
import Header from "@/components/roost/Header";
import { getListing } from "@/features/listing/getListing";
import { listingMetadata } from "@/features/listing/listingMetadata";
import { ListingView } from "@/features/listing/ListingView";
import { FONTS } from "@/lib/roost-data";

export async function generateMetadata({ params }: PageProps<"/listings/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  return listingMetadata(await getListing(ref));
}

export default function ListingPage({ params, searchParams }: PageProps<"/listings/[ref]">) {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: FONTS.body }}>
      <Header />
      <Suspense fallback={<AnnonceSkeleton />}>
        <ListingView params={params} searchParams={searchParams} />
      </Suspense>
      <Footer />
    </div>
  );
}
