'use client';

import { Button, Checkbox, RadioGroup, Select, Switch, TextField, useToast } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import { FormActions, FormError, FormSection, FullRow, PhotoField } from '../../components/FormParts';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { errorMessage } from '../../hooks/useCommand';
import { useZodForm } from '../../hooks/useZodForm';
import { toMajorInput } from '../../lib/amount';
import { HEATING_LABELS, LOT_TYPE_LABELS } from '../../lib/labels';
import { biensPaths } from '../../paths';
import { useBiensAction, useImmeubles, useLot, useLots } from '../../queries';
import type { ImmeubleRow } from '../../schemas/immeubles';
import { AMENITIES, HEATINGS, LOT_TYPES, lotFormSchema } from '../../schemas/lots';
import type { LotDetail } from '../../schemas/lots';
import type { Currency } from '../../../../format/money';

function blankValues(immeubleId = '') {
  return {
    name: '',
    type: 'appartement' as const,
    immeubleId,
    address: '',
    complement: '',
    postalCode: '',
    city: '',
    surface: '',
    rooms: '',
    floor: '',
    elevator: false,
    heating: 'electrique' as const,
    amenities: [] as string[],
    rent: '',
    charges: '',
    photoNames: [] as string[],
  };
}

function valuesOf(detail: LotDetail, currency: Currency) {
  const { values } = detail;
  return {
    ...values,
    surface: String(values.surface).replace('.', ','),
    rooms: values.rooms === null ? '' : String(values.rooms),
    rent: values.rent === null ? '' : toMajorInput(values.rent, currency),
    charges: values.charges === null ? '' : toMajorInput(values.charges, currency),
  };
}

function LotFormBody({ id, currency, immeubles, detail }: { id?: string; currency: Currency; immeubles: readonly ImmeubleRow[]; detail: LotDetail | null }) {
  const { push } = useBiensEnvironment();
  const toast = useToast();
  const schema = useMemo(() => lotFormSchema(currency), [currency]);
  const form = useZodForm(schema, detail ? valuesOf(detail, currency) : blankValues());
  const [failure, setFailure] = useState<string | null>(null);
  const save = useBiensAction((source, input: { values: Parameters<typeof source.createLot>[0] }) =>
    id ? source.updateLot(id, input.values).then(() => ({ id })) : source.createLot(input.values),
  );

  const chooseImmeuble = (immeubleId: string) => {
    form.set('immeubleId', immeubleId);
    const immeuble = immeubles.find((item) => item.id === immeubleId);
    if (immeuble && form.values.address.trim() === '') {
      form.set('address', immeuble.address);
      form.set('postalCode', immeuble.postalCode);
      form.set('city', immeuble.city);
    }
  };

  const submit = form.submit((values, submitter) => {
      const another = submitter?.dataset.mode === 'another';
      setFailure(null);
      save.mutate(
        { values },
        {
          onSuccess: (result) => {
            toast.show({ tone: 'success', title: id ? 'Modifications enregistrées' : `Lot « ${values.name} » créé` });
            if (another) form.reset(blankValues(values.immeubleId));
            else push(biensPaths.lot(result.id));
          },
          onError: (error) => { setFailure(errorMessage(error)); },
        },
      );
  });

  const cancelHref = id ? biensPaths.lot(id) : biensPaths.lots;

  return (
    <form noValidate onSubmit={submit} className="flex max-w-4xl flex-col gap-4">
      <FormError message={failure} />
      <FormSection title="Identité du lot">
        <TextField label="Nom du lot *" placeholder="Apt A3" {...form.field('name')} />
        <Select
          label="Type *"
          placeholder="Choisir un type"
          options={LOT_TYPES.map((entry) => ({ value: entry, label: LOT_TYPE_LABELS[entry] }))}
          value={form.values.type}
          onValueChange={(next) => {
            const type = LOT_TYPES.find((entry) => entry === next);
            if (type) form.set('type', type);
          }}
        />
        <FullRow>
          <Select
            label="Immeuble *"
            placeholder="Choisir un immeuble"
            searchable
            options={immeubles.filter((item) => !item.archived).map((item) => ({ value: item.id, label: item.name, description: `${item.address}, ${item.city}` }))}
            value={form.values.immeubleId}
            onValueChange={chooseImmeuble}
            error={form.error('immeubleId') ? 'Choisissez l’immeuble du lot' : undefined}
          />
        </FullRow>
      </FormSection>
      <FormSection title="Adresse">
        <FullRow>
          <TextField label="Adresse *" placeholder="Numéro et voie" autoComplete="street-address" {...form.field('address')} />
        </FullRow>
        <TextField label="Complément" placeholder="Bâtiment, étage" {...form.field('complement')} />
        <TextField label="Code postal *" placeholder="75011" inputMode="numeric" autoComplete="postal-code" {...form.field('postalCode')} />
        <TextField label="Ville *" placeholder="Paris" autoComplete="address-level2" {...form.field('city')} />
      </FormSection>
      <FormSection title="Caractéristiques">
        <TextField label="Surface, m² *" placeholder="54" inputMode="decimal" {...form.field('surface')} />
        <TextField label="Pièces" placeholder="2" inputMode="numeric" {...form.field('rooms')} />
        <TextField label="Étage" placeholder="3" {...form.field('floor')} />
        <div className="flex items-end pb-1">
          <Switch label="Ascenseur" checked={form.values.elevator} onCheckedChange={(checked) => { form.set('elevator', checked); }} />
        </div>
        <FullRow>
          <RadioGroup
            label="Chauffage"
            options={HEATINGS.map((entry) => ({ value: entry, label: HEATING_LABELS[entry] }))}
            value={form.values.heating}
            onValueChange={(next) => {
              const heating = HEATINGS.find((entry) => entry === next);
              if (heating) form.set('heating', heating);
            }}
          />
        </FullRow>
      </FormSection>
      <FormSection title="Équipements">
        {AMENITIES.map((item) => (
          <Checkbox
            key={item.id}
            label={item.label}
            checked={form.values.amenities.includes(item.id)}
            onChange={(event) => {
              form.set('amenities', event.target.checked ? [...form.values.amenities, item.id] : form.values.amenities.filter((entry) => entry !== item.id));
            }}
          />
        ))}
      </FormSection>
      <FormSection title="Photos">
        <FullRow>
          <PhotoField names={form.values.photoNames} onChange={(names) => { form.set('photoNames', names); }} />
        </FullRow>
      </FormSection>
      <FormSection title="Loyer indicatif">
        <TextField label="Loyer mensuel, € *" placeholder="820" inputMode="decimal" hint="Hors charges" {...form.field('rent')} />
        <TextField label="Charges, €" placeholder="60" inputMode="decimal" {...form.field('charges')} />
      </FormSection>
      <FormActions
        cancelHref={cancelHref}
        submitLabel={id ? 'Enregistrer les modifications' : 'Enregistrer le lot'}
        pending={save.isPending}
        extra={
          id ? null : (
            <Button variant="secondary" type="submit" data-mode="another" loading={save.isPending}>
              Enregistrer et ajouter un autre
            </Button>
          )
        }
      />
    </form>
  );
}

export function LotForm({ id }: { id?: string }) {
  const immeubles = useImmeubles();
  const lots = useLots();
  const detail = useLot(id ?? '');
  return (
    <>
      <PageHeader
        crumbs={id ? [{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: detail.data?.lot.name ?? 'Lot', href: biensPaths.lot(id) }, { label: 'Modifier' }] : [{ label: 'Accueil', href: '/' }, { label: 'Biens', href: biensPaths.lots }, { label: 'Nouveau lot' }]}
        title={id ? `Modifier ${detail.data?.lot.name ?? 'le lot'}` : 'Nouveau lot'}
        subtitle="Les champs marqués d’un astérisque sont obligatoires."
      />
      <QueryBoundary query={lots} errorTitle="Les biens n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} />}>
        {(lotsData) => (
      <QueryBoundary query={immeubles} errorTitle="Les immeubles n’ont pas pu être chargés" skeleton={<SkeletonRows rows={6} />}>
        {(list) =>
          id ? (
            <QueryBoundary query={detail} errorTitle="Le lot n’a pas pu être chargé" skeleton={<SkeletonRows rows={6} />}>
              {(lot) =>
                lot ? (
                  <LotFormBody id={id} currency={lot.currency} immeubles={list.items} detail={lot} />
                ) : (
                  <NotFoundPanel title="Ce lot est introuvable" backHref={biensPaths.lots} backLabel="Retour aux biens" />
                )
              }
            </QueryBoundary>
          ) : (
            <LotFormBody currency={lotsData.currency} immeubles={list.items} detail={null} />
          )
        }
      </QueryBoundary>
        )}
      </QueryBoundary>
    </>
  );
}
