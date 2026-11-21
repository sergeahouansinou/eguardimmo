'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FailureAlert } from '@/components/FailureAlert';
import { FileDrop } from '@/components/FileDrop';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList } from '@/components/Section';
import { useFlash } from '@/components/flash';
import { addDays, addMonths, todayIso } from '@/lib/dates';
import { ATTESTATION_RULES } from '@/lib/files';
import { useAttemptKey } from '@/tenant/clientId';
import { INSURANCE_WORDING } from '@/tenant/insuranceLabels';
import { useDepositAttestation, useInsurance } from '@/tenant/insuranceQueries';
import type { LeaseSummary } from '@/tenant/model';
import { useSelectedLease } from '@/tenant/selectedLease';
import { depositSchema } from './depositForm';
import type { DepositValues } from './depositForm';

const CRUMBS = [{ label: 'Assurance', href: '/assurance' }, { label: 'Déposer une attestation' }];

export function ApiDepotScreen() {
  const selection = useSelectedLease();
  return (
    <>
      <PageHeader title="Déposer une attestation" crumbs={CRUMBS} subtitle="Votre agence vérifie l’attestation avant de la retenir." />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(lease) => <DepositContent key={lease.id} lease={lease} />}
      </LeaseGate>
    </>
  );
}

function DepositContent({ lease }: { lease: LeaseSummary }) {
  const insurance = useInsurance(lease.id);
  if (lease.inGrace) {
    return (
      <Alert tone="warning" title="Dépôt impossible">
        Ce bail est terminé : votre accès est en lecture seule et vous ne pouvez plus déposer d’attestation.
      </Alert>
    );
  }
  if (insurance.data?.submissions.some((item) => item.status === 'pending')) {
    return (
      <Alert tone="info" title="Un dépôt est déjà en attente">
        <span className="flex flex-wrap items-center gap-2">
          Votre agence n’a pas encore traité votre dernier dépôt. Retirez-le avant d’en déposer un autre.
          <Button asChild variant="link" size="sm">
            <Link href={`/assurance?bail=${lease.id}`}>Voir mes dépôts</Link>
          </Button>
        </span>
      </Alert>
    );
  }
  return <DepositForm lease={lease} />;
}

function DepositForm({ lease }: { lease: LeaseSummary }) {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const deposit = useDepositAttestation();
  const attemptKey = useAttemptKey();
  const today = useMemo(() => todayIso(), []);
  const schema = useMemo(() => depositSchema(today), [today]);
  const form = useForm<DepositValues>({
    resolver: zodResolver(schema),
    defaultValues: { insurer: '', policyNumber: '', startsOn: today, endsOn: addDays(addMonths(today, 12), -1), file: null },
  });
  const { register, handleSubmit, formState, control } = form;

  const submit = handleSubmit((values) => {
    const file = values.file;
    if (!(file instanceof File)) return;
    const clientId = attemptKey([lease.id, values.insurer, values.policyNumber, values.startsOn, values.endsOn, file.name, String(file.size), String(file.lastModified)].join('|'));
    deposit.mutate(
      { leaseId: lease.id, insurer: values.insurer, policyNumber: values.policyNumber, startsOn: values.startsOn, endsOn: values.endsOn, file, clientId },
      {
        onSuccess: () => {
          show({ tone: 'success', title: 'Attestation envoyée', detail: 'Votre agence la vérifiera prochainement.', path: '/assurance' });
          router.push(`/assurance?bail=${lease.id}`);
        },
      },
    );
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {deposit.isError ? <FailureAlert title="L’attestation n’a pas pu être envoyée" error={deposit.error} wording={INSURANCE_WORDING} /> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="ad-fichier" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ad-fichier">Attestation</CardTitle>
            </CardHeader>
            <Controller
              control={control}
              name="file"
              render={({ field, fieldState }) => (
                <FileDrop
                  title="Déposer l’attestation d’assurance"
                  rules={ATTESTATION_RULES}
                  files={field.value instanceof File ? [field.value] : []}
                  onFilesChange={(files) => { field.onChange(files[0] ?? null); }}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Card>
          <Card role="region" aria-labelledby="ad-contrat" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ad-contrat">Contrat</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Assureur *" placeholder="Mutuelle Horizon" autoComplete="off" {...register('insurer')} error={formState.errors.insurer?.message} />
              <TextField label="N° de contrat *" placeholder="HAB-2027-48213" autoComplete="off" {...register('policyNumber')} error={formState.errors.policyNumber?.message} />
              <TextField label="Date de début *" placeholder="JJ/MM/AAAA" type="date" {...register('startsOn')} error={formState.errors.startsOn?.message} />
              <TextField label="Date de fin *" placeholder="JJ/MM/AAAA" type="date" {...register('endsOn')} error={formState.errors.endsOn?.message} />
            </div>
          </Card>
        </div>
        <Card role="region" aria-labelledby="ad-info" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="ad-info">L’attestation doit indiquer</CardTitle>
          </CardHeader>
          <KeyValueList
            labelWidth="5rem"
            items={[
              { label: 'Logement', value: lease.mainUnit?.address ?? lease.reference },
              { label: 'Garantie', value: 'Risques locatifs' },
              { label: 'Période', value: 'Dates de validité' },
            ]}
          />
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/assurance?bail=${lease.id}`}>Annuler</Link>
        </Button>
        <Button type="submit" loading={deposit.isPending}>
          <Icon icon={Upload} />
          Envoyer l’attestation
        </Button>
      </div>
    </form>
  );
}
