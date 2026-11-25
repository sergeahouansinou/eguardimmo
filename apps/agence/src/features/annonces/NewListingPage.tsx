"use client";

import { useRouter } from "next/navigation";
import { PageFrame, useNotify } from "@/features/kit";
import { ListingFormView } from "./ListingFormView";
import { annoncesPaths, listingHref } from "./paths";

export function NewListingPage() {
  const router = useRouter();
  const notify = useNotify();
  return (
    <PageFrame crumbs={[{ label: "Annonces", href: annoncesPaths.list }, { label: "Nouvelle annonce" }]} title="Nouvelle annonce" description="L’annonce est créée en brouillon : vous la publierez quand elle sera complète.">
      <ListingFormView
        listing={null}
        cancelHref={annoncesPaths.list}
        onSaved={(listing) => {
          notify.success("Brouillon créé", listing.title ?? undefined);
          router.push(listingHref(listing.id));
        }}
      />
    </PageFrame>
  );
}
