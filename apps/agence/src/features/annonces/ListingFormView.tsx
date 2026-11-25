"use client";

import { Alert, Button, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { FormCheckCards, FormSegmented, FormSelect, FormTextarea, LinkButton, useSchemaForm } from "@/features/kit";
import { OrgApiError, errorMessage } from "@/features/org/errors";
import { CURRENCIES, currencyName, currencySymbol } from "@/lib/currency";
import { emptyListingForm, formFromListing, listingFormSchema, toPayload } from "./form";
import type { ListingForm } from "./form";
import { useCreateListing, useUpdateListing } from "./hooks";
import { AMENITY_LABELS, CATEGORY_LABELS, KIND_LABELS, KIND_PRICE_UNIT, POLICY_LABELS, PRICE_UNIT_LABELS } from "./labels";
import { AMENITIES, CATEGORIES, KINDS, POLICIES } from "./schemas";
import type { Listing } from "./schemas";

const KIND_OPTIONS = KINDS.map((value) => ({ value, label: KIND_LABELS[value] }));
const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
const POLICY_OPTIONS = POLICIES.map((value) => ({ value, label: POLICY_LABELS[value] }));
const AMENITY_OPTIONS = AMENITIES.map((value) => ({ value, label: AMENITY_LABELS[value] }));
const CURRENCY_OPTIONS = CURRENCIES.map((value) => ({ value, label: `${currencyName(value)} (${currencySymbol(value)})` }));

const SERVER_FIELDS: Readonly<Record<string, keyof ListingForm>> = {
  category: "category",
  title: "title",
  description: "description",
  neighbourhood: "neighbourhood",
  price_minor: "price",
  currency: "currency",
  deposit_minor: "deposit",
  capacity: "capacity",
  area_m2: "areaM2",
  rooms: "rooms",
  min_nights: "minNights",
  cancellation_policy: "cancellationPolicy",
  amenities: "amenities",
};

export interface ListingFormViewProps {
  listing: Listing | null;
  onSaved: (listing: Listing) => void;
  onReload?: () => void;
  cancelHref: string;
}

export function ListingFormView({ listing, onSaved, onReload, cancelHref }: ListingFormViewProps) {
  const create = useCreateListing();
  const update = useUpdateListing();
  const creating = listing === null;
  const form = useSchemaForm<ListingForm, ListingForm>(listingFormSchema, listing === null ? emptyListingForm() : formFromListing(listing));
  const kind = useWatch({ control: form.control, name: "kind" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const [failure, setFailure] = useState<OrgApiError | Error | null>(null);
  const { errors } = form.formState;
  const unit = PRICE_UNIT_LABELS[KIND_PRICE_UNIT[kind]];

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const payload = toPayload(values, creating);
    try {
      const saved = listing === null ? await create.mutateAsync(payload) : await update.mutateAsync({ listing, payload });
      onSaved(saved);
    } catch (error: unknown) {
      const named = error instanceof OrgApiError ? Object.entries(error.fieldErrors).flatMap(([name, messages]) => (SERVER_FIELDS[name] === undefined ? [] : [[SERVER_FIELDS[name], messages[0] ?? ""] as const])) : [];
      named.forEach(([name, message]) => {
        form.setError(name, { type: "server", message });
      });
      if (named.length === 0) setFailure(error instanceof Error ? error : new Error(errorMessage(error)));
    }
  });

  const stale = failure instanceof OrgApiError && failure.kind === "stale";

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {failure === null ? null : (
        <Alert tone={stale ? "warning" : "danger"} title={stale ? "Annonce modifiée entre-temps" : undefined}>
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {stale && onReload ? (
              <Button variant="secondary" size="sm" onClick={onReload}>
                Recharger l’annonce
              </Button>
            ) : null}
          </span>
        </Alert>
      )}
      <Alert tone="info">La ville de l’annonce ne se choisit pas encore depuis cet écran. Sans ville, l’annonce reste en brouillon et ne peut pas être publiée.</Alert>
      {creating ? (
        <FormSegmented control={form.control} name="kind" label="Type d’annonce" options={KIND_OPTIONS} />
      ) : (
        <p className="text-body text-fg-muted">
          Type d’annonce : <strong className="text-fg">{KIND_LABELS[kind]}</strong> (non modifiable)
        </p>
      )}
      <FormSelect control={form.control} name="category" label="Catégorie" placeholder="Choisir une catégorie" options={CATEGORY_OPTIONS} />
      <TextField label="Titre" placeholder="Ex. : Studio lumineux près du canal" error={errors.title?.message} {...form.register("title")} />
      <FormTextarea control={form.control} name="description" label="Description" placeholder="Décrivez le logement en texte brut." rows={5} />
      <TextField label="Quartier" placeholder="Ex. : Canal Saint-Martin" error={errors.neighbourhood?.message} {...form.register("neighbourhood")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={`Prix ${unit}`} placeholder="Ex. : 85" inputMode="decimal" error={errors.price?.message} {...form.register("price")} />
        <FormSelect control={form.control} name="currency" label="Devise" placeholder="Choisir une devise" options={CURRENCY_OPTIONS} />
        <TextField label="Dépôt de garantie" placeholder="Ex. : 200" inputMode="decimal" hint={`En ${currencyName(currency).toLowerCase()}`} error={errors.deposit?.message} {...form.register("deposit")} />
        <TextField label="Durée minimale (nuits)" placeholder="Ex. : 2" inputMode="numeric" error={errors.minNights?.message} {...form.register("minNights")} />
        <TextField label="Capacité d’accueil" placeholder="Ex. : 4" inputMode="numeric" error={errors.capacity?.message} {...form.register("capacity")} />
        <TextField label="Surface (m²)" placeholder="Ex. : 45" inputMode="numeric" error={errors.areaM2?.message} {...form.register("areaM2")} />
        <TextField label="Nombre de pièces" placeholder="Ex. : 2" inputMode="numeric" error={errors.rooms?.message} {...form.register("rooms")} />
        <FormSelect control={form.control} name="cancellationPolicy" label="Politique d’annulation" placeholder="Choisir une politique" options={POLICY_OPTIONS} />
      </div>
      <FormCheckCards control={form.control} name="amenities" legend="Équipements" options={AMENITY_OPTIONS} />
      <div className="flex flex-wrap justify-end gap-2">
        <LinkButton href={cancelHref} variant="secondary">
          Annuler
        </LinkButton>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {creating ? "Créer le brouillon" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
