"use client";

import { Alert, Badge, Button } from "@eguardimmo/ui";
import { useState } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionDialog, DetailList, LinkButton, PageFrame, useNotify } from "@/features/kit";
import { OrgApiError, errorMessage } from "@/features/org/errors";
import { formatMoney } from "@/features/org/format";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { formatDateTime } from "@/features/shared/dates";
import { useArchiveListing, useListing, usePublishListing } from "./hooks";
import { AMENITY_LABELS, CATEGORY_LABELS, KIND_LABELS, POLICY_LABELS, PRICE_UNIT_LABELS, STATUS_LABELS, STATUS_TONES, missingLabels } from "./labels";
import { annoncesPaths, editListingHref } from "./paths";
import type { Listing } from "./schemas";

type Pending = "publish" | "archive" | null;

const dash = "Non renseigné";

function Content({ listing, onAction }: { listing: Listing; onAction: (action: Exclude<Pending, null>) => void }) {
  const archived = listing.status === "archived";
  const unit = PRICE_UNIT_LABELS[listing.priceUnit];
  return (
    <>
      {listing.missing.length > 0 && listing.status !== "published" ? (
        <Alert tone="warning" title="Publication impossible pour l’instant">
          Il manque {missingLabels(listing.missing)}.
        </Alert>
      ) : null}
      <SectionCard
        title="Annonce"
        action={
          <span className="flex flex-wrap gap-2">
            {archived ? null : <LinkButton href={editListingHref(listing.id)}>Modifier</LinkButton>}
            {listing.status === "published" ? null : (
              <Button
                disabled={listing.missing.length > 0}
                onClick={() => {
                  onAction("publish");
                }}
              >
                {archived ? "Republier" : "Publier"}
              </Button>
            )}
            {archived ? null : (
              <Button
                variant="secondary"
                onClick={() => {
                  onAction("archive");
                }}
              >
                Archiver
              </Button>
            )}
          </span>
        }
      >
        <DetailList
          items={[
            { label: "Statut", value: <Badge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</Badge> },
            { label: "Référence publique", value: listing.publicRef },
            { label: "Type", value: `${KIND_LABELS[listing.kind]}, ${CATEGORY_LABELS[listing.category].toLowerCase()}` },
            { label: "Ville", value: listing.city === null ? dash : `${listing.city.name}${listing.city.postalCode === null ? "" : ` (${listing.city.postalCode})`}` },
            { label: "Quartier", value: listing.neighbourhood ?? dash },
            { label: "Prix", value: listing.price === null ? dash : `${formatMoney(listing.price)} ${unit}` },
            { label: "Dépôt de garantie", value: listing.deposit === null ? dash : formatMoney(listing.deposit) },
            { label: "Capacité", value: listing.capacity === null ? dash : `${String(listing.capacity)} personne${listing.capacity > 1 ? "s" : ""}` },
            { label: "Surface", value: listing.areaM2 === null ? dash : `${String(listing.areaM2)} m²` },
            { label: "Pièces", value: listing.rooms === null ? dash : String(listing.rooms) },
            { label: "Durée minimale", value: `${String(listing.minNights)} nuit${listing.minNights > 1 ? "s" : ""}` },
            { label: "Annulation", value: POLICY_LABELS[listing.cancellationPolicy] },
            { label: "Publiée le", value: listing.publishedAt === null ? dash : formatDateTime(listing.publishedAt) },
          ]}
        />
      </SectionCard>
      <SectionCard title="Description">
        <p className="whitespace-pre-line px-4 pb-4 text-body text-fg">{listing.description ?? dash}</p>
      </SectionCard>
      <SectionCard title="Équipements">
        <p className="px-4 pb-4 text-body text-fg">{listing.amenities.length === 0 ? dash : listing.amenities.map((amenity) => AMENITY_LABELS[amenity]).join(", ")}</p>
      </SectionCard>
    </>
  );
}

export function ListingDetailPage({ id }: { id: string }) {
  const query = useListing(id);
  const publish = usePublishListing();
  const archive = useArchiveListing();
  const notify = useNotify();
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<OrgApiError | Error | null>(null);

  if (query.error instanceof OrgApiError && query.error.kind === "not_found") {
    return <NotFoundState title="Annonce introuvable" description={query.error.message} backHref={annoncesPaths.list} backLabel="Retour aux annonces" />;
  }
  const listing = query.data;

  const close = () => {
    setPending(null);
    setFailure(null);
  };

  const confirm = async () => {
    if (listing === undefined || pending === null) return;
    setFailure(null);
    try {
      if (pending === "publish") await publish.mutateAsync(listing);
      else await archive.mutateAsync(listing);
      notify.success(pending === "publish" ? "Annonce publiée" : "Annonce archivée", listing.title ?? undefined);
      close();
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error : new Error(errorMessage(error)));
      if (error instanceof OrgApiError && error.kind === "stale") query.refetch();
    }
  };

  const stale = failure instanceof OrgApiError && failure.kind === "stale";
  const incomplete = failure instanceof OrgApiError && failure.code === "listing_incomplete";
  const missing = incomplete && Array.isArray(failure.extensions.missing) ? missingLabels(failure.extensions.missing.filter((item): item is string => typeof item === "string")) : null;

  return (
    <PageFrame
      crumbs={[{ label: "Annonces", href: annoncesPaths.list }, { label: listing?.title ?? "Annonce" }]}
      title={listing?.title ?? "Annonce"}
      description="Fiche de gestion de l’annonce."
    >
      {query.isError ? <QueryFailure error={query.error} label="L’annonce" onRetry={query.refetch} /> : listing === undefined ? <LoadingPanel label="L’annonce" /> : <Content listing={listing} onAction={setPending} />}
      <ActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={pending === "archive" ? "Archiver cette annonce ?" : listing?.status === "archived" ? "Republier cette annonce ?" : "Publier cette annonce ?"}
        description={
          pending === "archive"
            ? "L’annonce disparaît de la recherche. Les réservations déjà prises restent valables, et vous pourrez la republier."
            : "L’annonce devient visible de tous les voyageurs sur la place de marché."
        }
        confirmLabel={pending === "archive" ? "Archiver" : listing?.status === "archived" ? "Republier" : "Publier"}
        loading={publish.isPending || archive.isPending}
        error={stale ? `${failure.message} La fiche vient d’être rechargée : vérifiez-la avant de recommencer.` : missing !== null ? `Il manque ${missing}.` : failure === null ? null : failure.message}
        onConfirm={() => {
          void confirm();
        }}
      />
    </PageFrame>
  );
}
