'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { Async3 } from '@/components/ScreenState';
import { KeyValueList } from '@/components/Section';
import { useAttestations, useDepositAttestation, useHome, useLease } from '@/data/queries';
import { attestationInputSchema } from '@/data/schemas/logement';
import type { Attestation, AttestationInput, Lease } from '@/data/schemas/logement';
import { addDays, addMonths } from '@/lib/dates';
import { ATTESTATION_RULES, checkFile } from '@/lib/files';
import { insuranceView } from './insurance';

const CRUMBS = [{ label: 'Assurance', href: '/assurance' }, { label: 'Déposer une attestation' }];

export function DepotScreen() {
  const attestations = useAttestations();
  const lease = useLease();
  const home = useHome();
  return (
    <Async3 a={attestations} b={lease} c={home} errorTitle="Le dépôt d’attestation n’a pas pu être préparé">
      {(items, leaseData, homeData) => <DepotForm items={items} lease={leaseData} today={homeData.today} />}
    </Async3>
  );
}

function DepotForm({ items, lease, today }: { items: Attestation[]; lease: Lease; today: string }) {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const deposit = useDepositAttestation();
  const view = insuranceView(items, today);
  const start = view.current ? addDays(view.current.endOn, 1) : today;
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>();
  const form = useForm<AttestationInput>({
    resolver: zodResolver(attestationInputSchema),
    defaultValues: {
      insurer: view.current?.insurer ?? '',
      contractNumber: '',
      startOn: start,
      endOn: addDays(addMonths(start, 12), -1),
      fileName: '',
      fileSize: 0,
    },
  });
  const { register, handleSubmit, formState, setValue } = form;

  const changeFiles = (next: File[]) => {
    const file = next[0];
    if (!file) {
      setFiles([]);
      setValue('fileName', '');
      setValue('fileSize', 0);
      return;
    }
    const check = checkFile(file, ATTESTATION_RULES);
    if (!check.ok) {
      setFileError(check.error);
      return;
    }
    setFileError(undefined);
    setFiles([file]);
    setValue('fileName', file.name, { shouldValidate: true });
    setValue('fileSize', file.size, { shouldValidate: true });
    if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') setValue('fileType', file.type, { shouldValidate: true });
  };

  const submit = handleSubmit((values) => {
    deposit.mutate(values, {
      onSuccess: (attestation) => {
        show({
          tone: 'success',
          title: 'Attestation envoyée',
          detail: `${attestation.label} a été déposée : ${lease.landlord.name} est prévenu.`,
          path: '/assurance',
        });
        router.push('/assurance');
      },
    });
  });

  const fileMessage = fileError ?? formState.errors.fileName?.message ?? formState.errors.fileType?.message ?? formState.errors.fileSize?.message;

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader title="Déposer une attestation" crumbs={CRUMBS} subtitle="Votre gestionnaire est prévenu dès le dépôt, sans autre démarche." />
      {deposit.isError ? (
        <Alert tone="danger" title="L’attestation n’a pas pu être envoyée">
          {deposit.error.message}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="ad-fichier" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ad-fichier">Attestation</CardTitle>
            </CardHeader>
            <FileDrop title="Déposer l’attestation d’assurance" rules={ATTESTATION_RULES} files={files} onFilesChange={changeFiles} error={fileMessage} />
          </Card>
          <Card role="region" aria-labelledby="ad-contrat" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="ad-contrat">Contrat</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Assureur *" placeholder="Mutuelle Horizon" {...register('insurer')} error={formState.errors.insurer?.message} />
              <TextField label="N° de contrat *" placeholder="HAB-2027-48213" autoComplete="off" {...register('contractNumber')} error={formState.errors.contractNumber?.message} />
              <TextField label="Date de début *" placeholder="JJ/MM/AAAA" type="date" {...register('startOn')} error={formState.errors.startOn?.message} />
              <TextField label="Date de fin *" placeholder="JJ/MM/AAAA" type="date" {...register('endOn')} error={formState.errors.endOn?.message} />
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
              { label: 'Assuré', value: lease.tenantName },
              { label: 'Adresse', value: lease.property.street },
              { label: 'Garantie', value: 'Risques locatifs' },
              { label: 'Période', value: 'Dates de validité' },
            ]}
          />
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/assurance">Annuler</Link>
        </Button>
        <Button type="submit" loading={deposit.isPending}>
          <Icon icon={Upload} />
          Envoyer l’attestation
        </Button>
      </div>
    </form>
  );
}
