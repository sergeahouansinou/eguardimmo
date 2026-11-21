'use client';

import { Alert, Button, Card, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { FilePicker, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { FormSelect, useTenantRequestsForm } from '../shared/form';
import { useLeaseDetail } from '../shared/hooks';
import { ActionError } from '../shared/parts/ActionError';
import { QueryState } from '../shared/parts/QueryState';
import { tenantRequestsPaths } from '../shared/paths';
import { useCreateInspection } from './hooks';
import { INSPECTION_KINDS, INSPECTION_PERFORMERS, kindLabel, performerLabel } from './model';
import { MAX_FILE_BYTES, PDF_MIME, inspectionFormSchema, toConformity, trimSignatories } from './schemas';
import type { InspectionFormValues } from './schemas';
import { SignatoriesFields } from './SignatoriesFields';

const CRUMBS = [{ label: 'Baux', href: '/baux' }, { label: 'États des lieux', href: tenantRequestsPaths.inspections }, { label: 'Nouvel état des lieux' }];

export function InspectionFormPage() {
  return (
    <RoleGate allowed={canManage} title="Nouvel état des lieux" crumbs={CRUMBS} message="L’enregistrement d’un état des lieux est réservé au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <InspectionFormGate />
    </RoleGate>
  );
}

function InspectionFormGate() {
  const { search } = useGestionNavigation();
  const leaseId = search.get('bail');
  const lease = useLeaseDetail(leaseId);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]} title="Nouvel état des lieux" subtitle={lease.data ? `Bail ${lease.data.reference}` : undefined} />
      {leaseId === null ? (
        <Alert tone="info" title="Aucun bail choisi">Ouvrez cette page depuis la liste des états des lieux d’un bail.</Alert>
      ) : lease.data ? (
        <InspectionForm leaseId={leaseId} />
      ) : (
        <QueryState query={lease} label="Chargement du bail" title="Impossible de charger le bail" notFound={{ title: 'Bail introuvable', description: 'Ce bail n’existe pas dans votre organisation.', backHref: tenantRequestsPaths.inspections, backLabel: 'Retour aux états des lieux' }} />
      )}
    </>
  );
}

function InspectionForm({ leaseId }: { leaseId: string }) {
  const { push } = useGestionNavigation();
  const create = useCreateInspection();
  const notify = useNotify();
  const [clientId] = useState(() => globalThis.crypto.randomUUID());
  const [failure, setFailure] = useState<unknown>(null);
  const form = useTenantRequestsForm<InspectionFormValues, InspectionFormValues>(inspectionFormSchema, {
    kind: 'entry',
    performedOn: '',
    performedBy: 'parties',
    conformity: '',
    signatories: [],
    file: null,
  });
  const kind = form.watch('kind');

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    if (values.file === null) return;
    try {
      const created = await create.mutateAsync({
        leaseId,
        input: {
          kind: values.kind,
          performedOn: values.performedOn,
          performedBy: values.performedBy,
          exitMatchesEntry: toConformity(values.conformity),
          signatories: trimSignatories(values.signatories),
          file: values.file,
          clientId,
        },
      });
      notify({ title: 'État des lieux enregistré', description: 'Il reste invisible du locataire tant que vous ne l’avez pas publié.' });
      push(tenantRequestsPaths.inspection(created.id));
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <Card role="region" aria-label="Nouvel état des lieux" className="gap-3">
      <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <FormSelect control={form.control} name="kind" label="Type *" placeholder="Entrée ou sortie" options={INSPECTION_KINDS.map((value) => ({ value, label: kindLabel[value] }))} />
          <TextField label="Réalisé le *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.performedOn?.message} {...form.register('performedOn')} />
          <FormSelect control={form.control} name="performedBy" label="Réalisé par *" placeholder="Qui a réalisé le relevé" options={INSPECTION_PERFORMERS.map((value) => ({ value, label: performerLabel[value] }))} />
        </div>
        {kind === 'exit' ? (
          <FormSelect
            control={form.control}
            name="conformity"
            label="Conformité à l’état d’entrée"
            placeholder="À renseigner avant la publication"
            hint="Elle fixe le délai de restitution du dépôt de garantie."
            options={[{ value: '', label: 'Non renseignée' }, { value: 'yes', label: 'Conforme à l’état d’entrée' }, { value: 'no', label: 'Différences avec l’état d’entrée' }]}
          />
        ) : null}
        <Controller
          control={form.control}
          name="file"
          render={({ field, fieldState }) => (
            <FilePicker
              label="PDF de l’état des lieux *"
              hint="PDF de 10 Mo au plus"
              accept={PDF_MIME}
              validate={(file) => (file.type !== PDF_MIME ? 'Le fichier doit être un PDF.' : file.size > MAX_FILE_BYTES ? 'Le PDF dépasse 10 Mo.' : null)}
              file={field.value}
              onFile={field.onChange}
              {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
            />
          )}
        />
        <SignatoriesFields form={form} />
        {failure === null ? null : <ActionError title="État des lieux non enregistré" error={failure} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => { push(tenantRequestsPaths.inspectionsOf(leaseId)); }}>Annuler</Button>
          <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer l’état des lieux</Button>
        </div>
      </form>
    </Card>
  );
}
