'use client';

import { Alert, Select, TextField, useToast } from '@eguardimmo/ui';
import { useState } from 'react';
import { FormActions, FormError, FormSection, FullRow, PhotoField } from '../../components/FormParts';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { errorMessage } from '../../hooks/useCommand';
import { useZodForm } from '../../hooks/useZodForm';
import { REPARTITION_LABELS } from '../../lib/labels';
import { formatNumber } from '../../lib/amount';
import { biensPaths } from '../../paths';
import { useBiensAction, useImmeuble } from '../../queries';
import { REPARTITIONS, immeubleFormSchema } from '../../schemas/immeubles';
import type { ImmeubleDetail } from '../../schemas/immeubles';

const BLANK = { name: '', address: '', postalCode: '', city: '', country: 'France', repartition: 'tantiemes' as const, photoNames: [] as string[] };

function ImmeubleFormBody({ id, detail }: { id?: string; detail: ImmeubleDetail | null }) {
  const { push } = useBiensEnvironment();
  const toast = useToast();
  const form = useZodForm(immeubleFormSchema, detail ? detail.values : BLANK);
  const [failure, setFailure] = useState<string | null>(null);
  const save = useBiensAction((source, input: { values: Parameters<typeof source.createImmeuble>[0] }) =>
    id ? source.updateImmeuble(id, input.values).then(() => ({ id })) : source.createImmeuble(input.values),
  );

  const submit = form.submit((values) => {
    setFailure(null);
    save.mutate(
      { values },
      {
        onSuccess: (result) => {
          toast.show({ tone: 'success', title: id ? 'Modifications enregistrées' : `Immeuble « ${values.name} » créé` });
          push(biensPaths.immeuble(result.id));
        },
        onError: (error) => { setFailure(errorMessage(error)); },
      },
    );
  });

  const sum = detail?.tantiemes.sum ?? 0;
  const total = detail?.tantiemes.total ?? 1000;

  return (
    <form noValidate onSubmit={submit} className="flex max-w-4xl flex-col gap-4">
      <FormError message={failure} />
      <FormSection title="Identité">
        <FullRow>
          <TextField label="Nom de l’immeuble *" placeholder="Les Tilleuls" {...form.field('name')} />
        </FullRow>
        <FullRow>
          <TextField label="Adresse *" placeholder="12 rue des Lilas" autoComplete="street-address" {...form.field('address')} />
        </FullRow>
        <TextField label="Code postal *" placeholder="75011" inputMode="numeric" autoComplete="postal-code" {...form.field('postalCode')} />
        <TextField label="Ville *" placeholder="Paris" autoComplete="address-level2" {...form.field('city')} />
        <TextField label="Pays *" placeholder="France" autoComplete="country-name" {...form.field('country')} />
      </FormSection>
      <FormSection title="Répartition des charges">
        <FullRow>
          <Select
            label="Clé de répartition par défaut"
            placeholder="Choisir une clé"
            options={REPARTITIONS.map((entry) => ({ value: entry, label: REPARTITION_LABELS[entry] }))}
            value={form.values.repartition}
            onValueChange={(next) => {
              const repartition = REPARTITIONS.find((entry) => entry === next);
              if (repartition) form.set('repartition', repartition);
            }}
          />
        </FullRow>
        <FullRow>
          <Alert tone={sum === total ? 'success' : 'info'} title={`Total des tantièmes ${formatNumber(sum)} / ${formatNumber(total)}`}>
            {id
              ? 'Somme des tantièmes de vos lots, sur le total de la copropriété.'
              : 'Les tantièmes de vos lots seront comptés ici une fois les lots rattachés.'}
          </Alert>
        </FullRow>
      </FormSection>
      <FormSection title="Photo de l’immeuble">
        <FullRow>
          <PhotoField names={form.values.photoNames} onChange={(names) => { form.set('photoNames', names); }} />
        </FullRow>
      </FormSection>
      <FormActions
        cancelHref={id ? biensPaths.immeuble(id) : biensPaths.immeubles}
        submitLabel={id ? 'Enregistrer les modifications' : 'Enregistrer l’immeuble'}
        pending={save.isPending}
      />
    </form>
  );
}

export function ImmeubleForm({ id }: { id?: string }) {
  const detail = useImmeuble(id ?? '');
  const crumbs = id
    ? [
        { label: 'Accueil', href: '/' },
        { label: 'Biens', href: biensPaths.lots },
        { label: 'Immeubles', href: biensPaths.immeubles },
        { label: detail.data?.immeuble.name ?? 'Immeuble', href: biensPaths.immeuble(id) },
        { label: 'Modifier' },
      ]
    : [
        { label: 'Accueil', href: '/' },
        { label: 'Biens', href: biensPaths.lots },
        { label: 'Immeubles', href: biensPaths.immeubles },
        { label: 'Nouvel immeuble' },
      ];
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={id ? `Modifier ${detail.data?.immeuble.name ?? 'l’immeuble'}` : 'Nouvel immeuble'}
        subtitle="Les lots se rattachent ensuite. Les tantièmes servent à répartir les charges communes."
      />
      {id ? (
        <QueryBoundary query={detail} errorTitle="L’immeuble n’a pas pu être chargé" skeleton={<SkeletonRows rows={6} />}>
          {(immeuble) =>
            immeuble ? (
              <ImmeubleFormBody id={id} detail={immeuble} />
            ) : (
              <NotFoundPanel title="Cet immeuble est introuvable" backHref={biensPaths.immeubles} backLabel="Retour aux immeubles" />
            )
          }
        </QueryBoundary>
      ) : (
        <ImmeubleFormBody detail={null} />
      )}
    </>
  );
}
