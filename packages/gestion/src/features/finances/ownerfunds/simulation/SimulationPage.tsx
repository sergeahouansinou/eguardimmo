'use client';

import { Alert, Button, EmptyState } from '@eguardimmo/ui';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { OwnerFundsGate, OwnerFundsSections } from '../parts';
import { ownerFundsPaths } from '../paths';
import { EMPTY_DRAFT, draftFromMandate, fieldErrorsOf, toProposal } from './form';
import type { SimulationDraft, SimulationErrors } from './form';
import { useFeeMandates, useSimulateFees } from './hooks';
import type { FeeMandateOption, FeeProposal } from './model';
import { SimulationForm } from './SimulationForm';
import { SimulationResult } from './SimulationResult';
import { ListLoading, LinkButton, PageHeader, errorMessage, useGestionNavigation } from '../../../locataires/kit';
import { links } from '../../../locataires/kit/links';

const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Honoraires', href: ownerFundsPaths.fees }, { label: 'Barème' }] as const;

function SimulationScreen({ mandates }: { mandates: readonly FeeMandateOption[] }) {
  const { search } = useGestionNavigation();
  const requested = search.get('mandat');
  const initial = mandates.find((mandate) => mandate.id === requested);
  const [draft, setDraft] = useState<SimulationDraft>(initial ? draftFromMandate(initial, EMPTY_DRAFT.months) : EMPTY_DRAFT);
  const [errors, setErrors] = useState<SimulationErrors>({});
  const [last, setLast] = useState<FeeProposal | null>(null);
  const simulate = useSimulateFees();
  const selected = mandates.find((mandate) => mandate.id === draft.mandateId);

  const run = (proposal: FeeProposal, currency: FeeMandateOption['currency']) => {
    setLast(proposal);
    simulate.mutate(proposal, { onError: (error) => { setErrors(fieldErrorsOf(error, currency)); } });
  };

  const submit = () => {
    const outcome = toProposal(draft, selected?.currency ?? 'EUR');
    if ('errors' in outcome) {
      setErrors(outcome.errors);
      return;
    }
    setErrors({});
    run(outcome.proposal, selected?.currency ?? 'EUR');
  };

  const change = (patch: Partial<SimulationDraft>) => {
    if (simulate.isError) simulate.reset();
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors({});
  };

  const fieldErrors = Object.keys(errors).length > 0;
  const outcome = simulate.data ?? null;
  return (
    <>
      <Alert tone="info" title="Simulation en lecture seule">
        Rien n’est modifié ni facturé. Pour appliquer un nouveau barème, passez un avenant signé par le mandant : il n’est jamais rétroactif.{' '}
        <LinkButton href={draft.mandateId === '' ? ownerFundsPaths.amendment : `${ownerFundsPaths.amendment}?mandat=${encodeURIComponent(draft.mandateId)}`} variant="secondary" size="sm">
          Passer un avenant
        </LinkButton>
      </Alert>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SimulationForm
          mandates={mandates}
          selected={selected}
          draft={draft}
          errors={errors}
          pending={simulate.isPending}
          onMandate={(id) => {
            const next = mandates.find((mandate) => mandate.id === id);
            setErrors({});
            simulate.reset();
            setDraft((previous) => (next ? draftFromMandate(next, previous.months) : previous));
          }}
          onChange={change}
          onSubmit={submit}
        />
        <SimulationResult
          pending={simulate.isPending}
          error={simulate.isError && !fieldErrors ? simulate.error : null}
          simulation={outcome}
          onRetry={() => { if (last !== null) run(last, selected?.currency ?? 'EUR'); }}
        />
      </div>
      {simulate.isError && fieldErrors ? <Alert tone="danger" title="Certains champs sont invalides">{errorMessage(simulate.error)}</Alert> : null}
    </>
  );
}

function MandateLoader() {
  const mandates = useFeeMandates();
  if (mandates.isPending && !mandates.isError) return <ListLoading label="Chargement des mandats" />;
  if (mandates.isError) {
    return (
      <Alert tone="danger" title="Les mandats n’ont pas pu être chargés">
        <span className="[overflow-wrap:anywhere]">{errorMessage(mandates.error)}</span>{' '}
        <Button variant="secondary" size="sm" onClick={mandates.retry}>Réessayer</Button>
      </Alert>
    );
  }
  const items = mandates.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState icon={FileText} title="Aucun mandat actif" description="La simulation porte sur un mandat actif. Créez ou activez un mandat pour simuler son barème.">
        <LinkButton href="/mandats" variant="secondary">Voir les mandats</LinkButton>
      </EmptyState>
    );
  }
  return <SimulationScreen mandates={items} />;
}

export function SimulationPage() {
  return (
    <OwnerFundsGate>
      <PageHeader crumbs={CRUMBS} title="Barème des honoraires" subtitle="Simulez l’effet d’un barème sur les derniers mois clos d’un mandat avant de proposer un avenant au mandant." />
      <OwnerFundsSections current="fees" />
      <MandateLoader />
    </OwnerFundsGate>
  );
}
