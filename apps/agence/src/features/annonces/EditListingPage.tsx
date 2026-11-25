"use client";

import { Alert } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { PageFrame, useNotify } from "@/features/kit";
import { OrgApiError } from "@/features/org/errors";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { ListingFormView } from "./ListingFormView";
import { useListing } from "./hooks";
import { annoncesPaths, listingHref } from "./paths";

export function EditListingPage({ id }: { id: string }) {
  const router = useRouter();
  const notify = useNotify();
  const query = useListing(id);
  if (query.error instanceof OrgApiError && query.error.kind === "not_found") {
    return <NotFoundState title="Annonce introuvable" description={query.error.message} backHref={annoncesPaths.list} backLabel="Retour aux annonces" />;
  }
  const listing = query.data;
  const crumbs = [{ label: "Annonces", href: annoncesPaths.list }, { label: listing?.title ?? "Annonce", href: listingHref(id) }, { label: "Modifier" }];
  return (
    <PageFrame crumbs={crumbs} title="Modifier l’annonce" description="Les changements s’appliquent immédiatement si l’annonce est publiée.">
      {query.isError ? (
        <QueryFailure error={query.error} label="L’annonce" onRetry={query.refetch} />
      ) : listing === undefined ? (
        <LoadingPanel label="L’annonce" />
      ) : listing.status === "archived" ? (
        <Alert tone="warning" title="Annonce archivée">
          Une annonce archivée ne se modifie plus : republiez-la d’abord depuis sa fiche.
        </Alert>
      ) : (
        <ListingFormView
          key={listing.lockVersion}
          listing={listing}
          cancelHref={listingHref(id)}
          onReload={query.refetch}
          onSaved={(saved) => {
            notify.success("Annonce enregistrée", saved.title ?? undefined);
            router.push(listingHref(saved.id));
          }}
        />
      )}
    </PageFrame>
  );
}
