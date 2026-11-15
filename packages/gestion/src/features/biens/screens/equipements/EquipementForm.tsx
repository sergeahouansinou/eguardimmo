'use client';

import { RadioGroup, Select, TextField, useToast } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import type { z } from 'zod';
import { FormActions, FormError, FormSection, FullRow, PhotoField } from '../../components/FormParts';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { errorMessage } from '../../hooks/useCommand';
import { useZodForm } from '../../hooks/useZodForm';
import { toMajorInput } from '../../lib/amount';
import { CHARGED_LABELS, FAMILY_LABELS } from '../../lib/labels';
import { biensPaths } from '../../paths';
import { useBiensAction, useEquipement, useImmeubles, useLots } from '../../queries';
import { FAMILIES, equipementFormSchema } from '../../schemas/equipements';
import type { EquipementDetail, EquipementValues } from '../../schemas/equipements';
import type { ImmeubleRow } from '../../schemas/immeubles';
import type { LotRow } from '../../schemas/lots';
import type { Currency } from '../../../../format/money';

const CHARGED = ['bailleur', 'locataire', 'copropriete'] as const;

function blankValues() {
  return {
    name: '',
    detail: '',
    family: 'electromenager' as const,
    place: '',
    room: '',
    brand: '',
    model: '',
    purchasedOn: '',
    price: '',
    warrantyEndsOn: '',
    chargedTo: 'bailleur' as const,
    photoNames: [] as string[],
  };
}

function valuesOf(detail: EquipementDetail, currency: Currency) {
  const { values } = detail;
  return {
    name: values.name,
    detail: values.detail,
    family: values.family,
    place: values.lotId ? `lot:${values.lotId}` : `immeuble:${values.immeubleId ?? ''}`,
    room: values.room,
    brand: values.brand,
    model: values.model,
    purchasedOn: values.purchasedOn ?? '',
    price: values.price === null ? '' : toMajorInput(values.price, currency),
    warrantyEndsOn: values.warrantyEndsOn ?? '',
    chargedTo: values.chargedTo,
    photoNames: values.photoNames,
  };
}

type FormData = z.output<ReturnType<typeof equipementFormSchema>>;

function toValues(data: FormData): EquipementValues {
  const [kind, target = ''] = data.place.split(':');
  return {
    name: data.name,
    detail: data.detail,
    family: data.family,
    lotId: kind === 'lot' ? target : null,
    immeubleId: kind === 'immeuble' ? target : null,
    room: data.room,
    brand: data.brand,
    model: data.model,
    purchasedOn: data.purchasedOn,
    price: data.price,
    warrantyEndsOn: data.warrantyEndsOn,
    chargedTo: data.chargedTo,
    photoNames: data.photoNames,
  };
}

function placeOptions(lots: readonly LotRow[], immeubles: readonly ImmeubleRow[]) {
  return [
    ...lots.filter((lot) => !lot.archived).map((lot) => ({ value: `lot:${lot.id}`, label: lot.name, description: lot.immeubleName })),
    ...immeubles.filter((item) => !item.archived).map((item) => ({ value: `immeuble:${item.id}`, label: `${item.name} (parties communes)`, description: `${item.address}, ${item.city}` })),
  ];
}

function EquipementFormBody({ id, currency, lots, immeubles, detail }: { id?: string; currency: Currency; lots: readonly LotRow[]; immeubles: readonly ImmeubleRow[]; detail: EquipementDetail | null }) {
  const { push } = useBiensEnvironment();
  const toast = useToast();
  const schema = useMemo(() => equipementFormSchema(currency), [currency]);
  const form = useZodForm(schema, detail ? valuesOf(detail, currency) : blankValues());
  const [failure, setFailure] = useState<string | null>(null);
  const save = useBiensAction((source, input: { values: EquipementValues }) =>
    id ? source.updateEquipement(id, input.values).then(() => ({ id })) : source.createEquipement(input.values),
  );

  const submit = form.submit((data) => {
    setFailure(null);
    save.mutate(
      { values: toValues(data) },
      {
        onSuccess: (result) => {
          toast.show({ tone: 'success', title: id ? 'Modifications enregistrées' : `Équipement « ${data.name} » ajouté` });
          push(biensPaths.equipement(result.id));
        },
        onError: (error) => { setFailure(errorMessage(error)); },
      },
    );
  });

  return (
    <form noValidate onSubmit={submit} className="flex max-w-4xl flex-col gap-4">
      <FormError message={failure} />
      <FormSection title="Identité">
        <TextField label="Nom de l’équipement *" placeholder="Climatiseur réversible" {...form.field('name')} />
        <TextField label="Précision" placeholder="3,5 kW" {...form.field('detail')} />
        <Select
          label="Famille *"
          placeholder="Choisir une famille"
          options={FAMILIES.map((entry) => ({ value: entry, label: FAMILY_LABELS[entry] }))}
          value={form.values.family}
          onValueChange={(next) => {
            const family = FAMILIES.find((entry) => entry === next);
            if (family) form.set('family', family);
          }}
        />
        <Select
          label="Bien ou parties communes *"
          placeholder="Choisir où il se trouve"
          searchable
          options={placeOptions(lots, immeubles)}
          value={form.values.place}
          onValueChange={(next) => { form.set('place', next); }}
          error={form.error('place') ? 'Choisissez où se trouve l’équipement' : undefined}
        />
        <TextField label="Pièce ou emplacement" placeholder="Séjour" {...form.field('room')} />
        <TextField label="Marque" placeholder="Thermea" {...form.field('brand')} />
        <TextField label="Modèle" placeholder="Duo 35 Inverter" {...form.field('model')} />
      </FormSection>
      <FormSection title="Achat et garantie">
        <TextField label="Date d’achat" type="date" placeholder="2025-06-20" {...form.field('purchasedOn')} />
        <TextField label="Prix d’achat, €" placeholder="1290" inputMode="decimal" {...form.field('price')} />
        <TextField label="Fin de garantie" type="date" placeholder="2027-06-20" {...form.field('warrantyEndsOn')} />
      </FormSection>
      <FormSection title="Entretien">
        <FullRow>
          <RadioGroup
            label="À la charge de"
            options={CHARGED.map((entry) => ({ value: entry, label: CHARGED_LABELS[entry] }))}
            value={form.values.chargedTo}
            onValueChange={(next) => {
              const charged = CHARGED.find((entry) => entry === next);
              if (charged) form.set('chargedTo', charged);
            }}
          />
        </FullRow>
      </FormSection>
      <FormSection title="Photos">
        <FullRow>
          <PhotoField names={form.values.photoNames} onChange={(names) => { form.set('photoNames', names); }} />
        </FullRow>
      </FormSection>
      <FormActions
        cancelHref={id ? biensPaths.equipement(id) : biensPaths.equipements}
        submitLabel={id ? 'Enregistrer les modifications' : 'Enregistrer l’équipement'}
        pending={save.isPending}
      />
    </form>
  );
}

export function EquipementForm({ id }: { id?: string }) {
  const lots = useLots();
  const immeubles = useImmeubles();
  const detail = useEquipement(id ?? '');
  const base = [
    { label: 'Accueil', href: '/' },
    { label: 'Biens', href: biensPaths.lots },
    { label: 'Équipements', href: biensPaths.equipements },
  ];
  return (
    <>
      <PageHeader
        crumbs={id ? [...base, { label: detail.data?.equipement.name ?? 'Équipement', href: biensPaths.equipement(id) }, { label: 'Modifier' }] : [...base, { label: 'Nouvel équipement' }]}
        title={id ? `Modifier ${detail.data?.equipement.name ?? 'l’équipement'}` : 'Nouvel équipement'}
        subtitle="Les champs marqués d’un astérisque sont obligatoires."
      />
      <QueryBoundary query={lots} errorTitle="Les biens n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} />}>
        {(lotsData) => (
          <QueryBoundary query={immeubles} errorTitle="Les immeubles n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} />}>
            {(immeublesData) =>
              id ? (
                <QueryBoundary query={detail} errorTitle="L’équipement n’a pas pu être chargé" skeleton={<SkeletonRows rows={6} />}>
                  {(equipement) =>
                    equipement ? (
                      <EquipementFormBody id={id} currency={equipement.currency} lots={lotsData.items} immeubles={immeublesData.items} detail={equipement} />
                    ) : (
                      <NotFoundPanel title="Cet équipement est introuvable" backHref={biensPaths.equipements} backLabel="Retour aux équipements" />
                    )
                  }
                </QueryBoundary>
              ) : (
                <EquipementFormBody currency={lotsData.currency} lots={lotsData.items} immeubles={immeublesData.items} detail={null} />
              )
            }
          </QueryBoundary>
        )}
      </QueryBoundary>
    </>
  );
}
