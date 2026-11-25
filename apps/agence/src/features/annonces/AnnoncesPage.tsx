"use client";

import { Alert, Badge, Button, EmptyState, SegmentedControl } from "@eguardimmo/ui";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, LinkButton, PageFrame } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatMoney } from "@/features/org/format";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { formatDate } from "@/features/shared/dates";
import { useListings } from "./hooks";
import { CATEGORY_LABELS, KIND_LABELS, PRICE_UNIT_LABELS, STATUS_LABELS, STATUS_TONES } from "./labels";
import { annoncesPaths, listingHref } from "./paths";
import { STATUSES } from "./schemas";
import type { Listing, Status } from "./schemas";

type Filter = Status | "all";

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "draft", label: "Brouillons" },
  { value: "published", label: "Publiées" },
  { value: "archived", label: "Archivées" },
] as const;

function isFilter(value: string): value is Filter {
  return value === "all" || (STATUSES as readonly string[]).includes(value);
}

const COLUMNS: readonly Column<Listing>[] = [
  {
    id: "title",
    header: "Annonce",
    role: "title",
    cell: (listing) => (
      <span className="flex flex-col">
        <Link href={listingHref(listing.id)} className="inline-flex min-h-11 items-center text-action-on-subtle underline underline-offset-2">
          {listing.title ?? "Annonce sans titre"}
        </Link>
        <span className="text-caption font-normal text-fg-subtle">Réf. {listing.publicRef}</span>
      </span>
    ),
  },
  { id: "kind", header: "Type", cell: (listing) => `${KIND_LABELS[listing.kind]}, ${CATEGORY_LABELS[listing.category].toLowerCase()}` },
  { id: "city", header: "Ville", cell: (listing) => listing.city?.name ?? <span className="text-fg-subtle">À renseigner</span> },
  { id: "price", header: "Prix", numeric: true, cell: (listing) => (listing.price === null ? "" : `${formatMoney(listing.price)} ${PRICE_UNIT_LABELS[listing.priceUnit]}`) },
  { id: "published", header: "Publiée le", cell: (listing) => (listing.publishedAt === null ? "" : formatDate(listing.publishedAt)) },
  { id: "status", header: "Statut", role: "status", cell: (listing) => <Badge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</Badge> },
];

export function AnnoncesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const listings = useListings(filter === "all" ? null : filter);

  return (
    <PageFrame
      crumbs={[{ label: "Annonces" }]}
      title="Annonces"
      description="Les annonces que votre agence diffuse sur la place de marché. Un brouillon n’est visible que de vous, une annonce archivée ne l’est plus de personne."
      actions={<LinkButton href={annoncesPaths.create} variant="primary">Nouvelle annonce</LinkButton>}
    >
      <SegmentedControl
        label="Filtrer par statut"
        options={FILTERS}
        value={filter}
        onValueChange={(value) => {
          if (isFilter(value)) setFilter(value);
        }}
      />
      {listings.isError ? (
        <QueryFailure error={listings.error} label="Les annonces" onRetry={listings.refetch} />
      ) : listings.isPending || listings.data === undefined ? (
        <LoadingPanel label="Les annonces" />
      ) : listings.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={filter === "all" ? "Aucune annonce" : "Aucune annonce dans ce statut"}
          description={filter === "all" ? "Créez un brouillon pour préparer votre première annonce." : "Changez de filtre pour voir les autres annonces."}
        />
      ) : (
        <>
          <DataTable caption="Annonces de l’agence" columns={COLUMNS} rows={listings.data} getRowId={(listing) => listing.id} />
          {listings.moreError ? <Alert tone="danger" title="La suite n’a pas pu être chargée">{listings.moreError.message}</Alert> : null}
          {listings.hasMore ? (
            <div>
              <Button variant="secondary" loading={listings.isFetchingMore} onClick={listings.fetchMore}>
                Afficher plus d’annonces
              </Button>
            </div>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
