'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { PenLine } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckboxField } from '@/components/CheckboxField';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { Async2 } from '@/components/ScreenState';
import { KeyValueList } from '@/components/Section';
import { useMandate, useProfile, useRevokeMandate, useSignMandate } from '@/data/queries';
import type { Profile } from '@/data/schemas/compte';
import { mandateInputSchema } from '@/data/schemas/loyers';
import type { Mandate, MandateInput } from '@/data/schemas/loyers';
import { formatDate } from '@/lib/dates';
import { maskIban } from '@/lib/iban';
import { formatMoney } from '@/lib/money';

const CRUMBS = [{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Prélèvement SEPA' }];

export function SepaScreen() {
  const mandate = useMandate();
  const profile = useProfile();
  return (
    <Async2 a={mandate} b={profile} errorTitle="Le mandat n’a pas pu être chargé">
      {(mandateData, profileData) => (
        <>
          <PageHeader
            title="Prélèvement SEPA"
            crumbs={CRUMBS}
            subtitle="Le loyer est prélevé automatiquement chaque mois sur votre compte."
          />
          {mandateData.status === 'actif' ? <ActiveMandate mandate={mandateData} /> : <MandateForm mandate={mandateData} profile={profileData} />}
        </>
      )}
    </Async2>
  );
}

function MandateAside({ mandate }: { mandate: Mandate }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Card role="region" aria-labelledby="sp-mandat" className="px-4 py-3">
        <CardHeader>
          <CardTitle as="h2" id="sp-mandat">Mandat</CardTitle>
        </CardHeader>
        <KeyValueList
          labelWidth="5.5rem"
          items={[
            { label: 'Créancier', value: mandate.creditor },
            { label: 'Référence', value: mandate.reference },
            { label: 'Type', value: 'Récurrent' },
            { label: 'Préavis', value: `${String(mandate.noticeDays)} jours avant` },
          ]}
        />
      </Card>
      <Card role="region" aria-labelledby="sp-droits" className="px-4 py-3">
        <CardHeader>
          <CardTitle as="h2" id="sp-droits">Vos droits</CardTitle>
        </CardHeader>
        <p className="text-body text-fg-muted">
          Vous pouvez révoquer le mandat à tout moment, et contester un prélèvement dans les 8 semaines.
        </p>
      </Card>
    </div>
  );
}

function ActiveMandate({ mandate }: { mandate: Mandate }) {
  const [confirming, setConfirming] = useState(false);
  const revoke = useRevokeMandate();
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const confirm = () => {
    revoke.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        show({ tone: 'success', title: 'Mandat révoqué', detail: 'Les prochains loyers ne seront plus prélevés.', path: '/loyers' });
        router.push('/loyers');
      },
    });
  };
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="sp-actif" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="sp-actif">Compte à débiter</CardTitle>
          </CardHeader>
          <Alert tone="success" title="Mandat actif">
            Signé le {mandate.signedOn ? formatDate(mandate.signedOn) : '—'}. Le loyer est prélevé le {mandate.dayOfMonth}er de chaque mois.
          </Alert>
          <KeyValueList
            labelWidth="8rem"
            items={[
              { label: 'Titulaire', value: mandate.holder ?? '—' },
              { label: 'IBAN', value: mandate.ibanLast4 ? maskIban(mandate.ibanLast4) : '—' },
              { label: 'Montant prélevé', value: `${formatMoney(mandate.amountCents)}, loyer et provisions` },
            ]}
          />
          <div className="pt-1">
            <Button variant="secondary" onClick={() => { setConfirming(true); }}>
              Révoquer le mandat
            </Button>
          </div>
        </Card>
        <MandateAside mandate={mandate} />
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Révoquer le mandat de prélèvement ?"
        description="Vos prochains loyers ne seront plus prélevés automatiquement. Vous pourrez signer un nouveau mandat à tout moment."
        confirmLabel="Révoquer le mandat"
        loading={revoke.isPending}
        onConfirm={confirm}
        error={revoke.isError ? revoke.error.message : undefined}
      />
    </>
  );
}

function MandateForm({ mandate, profile }: { mandate: Mandate; profile: Profile }) {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const sign = useSignMandate();
  const form = useForm<MandateInput>({
    resolver: zodResolver(mandateInputSchema),
    defaultValues: { holder: profile.bankHolder, iban: '', authorize: undefined, confirmHolder: undefined },
  });
  const { register, handleSubmit, formState, reset } = form;
  const submit = handleSubmit((values) => {
    sign.mutate(values, {
      onSuccess: () => {
        reset();
        show({ tone: 'success', title: 'Mandat SEPA signé', detail: 'Le prélèvement est activé : votre prochain loyer sera prélevé automatiquement.', path: '/loyers' });
        router.push('/loyers');
      },
    });
  });
  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {mandate.status === 'revoque' ? (
        <Alert tone="info" title="Mandat révoqué">
          Signez un nouveau mandat pour réactiver le prélèvement automatique.
        </Alert>
      ) : null}
      {sign.isError ? (
        <Alert tone="danger" title="Le mandat n’a pas pu être signé">
          {sign.error.message}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="sp-compte" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="sp-compte">Compte à débiter</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Titulaire du compte"
                placeholder="Koffi Adjovi"
                autoComplete="name"
                {...register('holder')}
                error={formState.errors.holder?.message}
              />
              <TextField
                label="IBAN"
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                autoComplete="off"
                spellCheck={false}
                hint="Masqué après enregistrement"
                {...register('iban')}
                error={formState.errors.iban?.message}
              />
              <TextField label="Montant prélevé" placeholder="850 €" readOnly value={`${formatMoney(mandate.amountCents)}, loyer et provisions`} />
              <TextField label="Jour de prélèvement" placeholder="Le 1er de chaque mois" readOnly value="Le 1er de chaque mois" />
            </div>
          </Card>
          <Card role="region" aria-labelledby="sp-autorisation" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="sp-autorisation">Autorisation</CardTitle>
            </CardHeader>
            <CheckboxField {...register('authorize')} error={formState.errors.authorize?.message}>
              J’autorise {mandate.creditor} à prélever mon compte chaque mois
            </CheckboxField>
            <CheckboxField {...register('confirmHolder')} error={formState.errors.confirmHolder?.message}>
              Je confirme être titulaire du compte
            </CheckboxField>
          </Card>
        </div>
        <MandateAside mandate={mandate} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/loyers">Annuler</Link>
        </Button>
        <Button type="submit" loading={sign.isPending}>
          <Icon icon={PenLine} />
          Signer le mandat
        </Button>
      </div>
    </form>
  );
}

