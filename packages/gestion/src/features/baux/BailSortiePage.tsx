'use client';

import { Check, LogOut } from 'lucide-react';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { LeaseGate } from './LeaseGate';
import { NoticeDialog } from './NoticeDialog';
import { useExits, useMarkReturned, useSetExitStep } from './hooks';
import { bauxPaths } from './paths';
import type { ExitStep, Lease, LeaseExit } from './schemas';
import { courriersPaths } from '../courriers/paths';
import { DescriptionList, LedgerLines, LinkButton, ListLoading, LoadError, PageHeader, SectionCard, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { daysBetween, formatDateFr, monthLabel, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const stepBadge: Record<ExitStep['status'], { label: string; tone: BadgeTone }> = {
  fait: { label: 'Fait', tone: 'success' },
  a_planifier: { label: 'À planifier', tone: 'warning' },
  prevu: { label: 'Prévu', tone: 'info' },
  a_faire: { label: 'À faire', tone: 'neutral' },
};

export function BailSortiePage({ id }: { id: string }) {
  return <LeaseGate id={id} title="Préavis et sortie">{(lease) => <Exit lease={lease} />}</LeaseGate>;
}

function Exit({ lease }: { lease: Lease }) {
  const exits = useExits();
  const lookups = useLeaseLookups();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const exit = exits.data?.find((entry) => entry.leaseId === lease.id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: lease.reference, href: bauxPaths.detail(lease.id) }, { label: 'Sortie' }];
  const canRecord = lease.status === 'en_cours' || lease.status === 'preavis';

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title="Préavis et sortie"
        subtitle={`Bail ${lease.reference}, ${lookups.unitLabel(lease.unitId)}, ${lookups.tenantsOf(lease)}`}
        badges={
          exit ? (
            <>
              <Badge tone="warning">Préavis reçu</Badge>
              <Badge tone="neutral">{`Départ le ${formatDateFr(exit.departure)}`}</Badge>
            </>
          ) : null
        }
        actions={
          <>
            {exit && !exit.depositReturned ? (
              <>
                <LinkButton href={`${bauxPaths.newEdl}?bien=${lease.unitId}`}>Planifier la visite</LinkButton>
                <LinkButton href={links.newCourrier({ modele: 'accuse-de-reception-du-preavis', locataire: lease.tenantIds[0], bien: lease.unitId })}>Accusé de réception</LinkButton>
              </>
            ) : null}
            {canRecord ? (
              <Button variant={exit ? 'secondary' : 'primary'} onClick={() => { setNoticeOpen(true); }}>
                {exit ? 'Modifier le préavis' : 'Enregistrer un préavis'}
              </Button>
            ) : null}
          </>
        }
      />
      {exits.isError ? <LoadError title="Le suivi de sortie n’a pas pu être chargé" /> : null}
      {exits.isPending ? <ListLoading label="Chargement du suivi de sortie" /> : null}
      {exits.data && !exit ? (
        <EmptyState
          icon={LogOut}
          title="Aucun préavis enregistré"
          description={canRecord ? 'Enregistrez le préavis reçu pour suivre les étapes de la sortie.' : 'La sortie ne peut être suivie que pour un bail en cours.'}
        >
          {canRecord ? <Button onClick={() => { setNoticeOpen(true); }}>Enregistrer un préavis</Button> : <LinkButton href={bauxPaths.detail(lease.id)}>Retour au bail</LinkButton>}
        </EmptyState>
      ) : null}
      {exit ? <ExitStats lease={lease} exit={exit} /> : null}
      {exit ? <ExitBody lease={lease} exit={exit} onEditNotice={canRecord ? () => { setNoticeOpen(true); } : undefined} /> : null}
      <NoticeDialog key={exit?.noticeReceivedOn ?? 'nouveau'} lease={lease} exit={exit} open={noticeOpen} onOpenChange={setNoticeOpen} />
    </>
  );
}

function exitFigures(lease: Lease, exit: LeaseExit) {
  const deductions = exit.repairs.filter((repair) => repair.imputation === 'degradation').reduce((sum, repair) => sum + repair.estimate, 0);
  const withheld = deductions + exit.unpaid + exit.chargesRegularisation;
  return { deductions, withheld, toReturn: Math.max(0, lease.deposit - withheld) };
}

function ExitStats({ lease, exit }: { lease: Lease; exit: LeaseExit }) {
  const { withheld, toReturn } = exitFigures(lease, exit);
  const remaining = daysBetween(todayIso(), exit.departure);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Départ" value={formatDateFr(exit.departure)}>
        <span className="text-caption text-fg-subtle">{remaining >= 0 ? `Dans ${String(remaining)} jours` : 'Date dépassée'}</span>
      </StatCard>
      <StatCard label="Dépôt de garantie" value={money(lease.deposit)}>
        <span className="text-caption text-fg-subtle">{lease.depositReceivedOn ? `Détenu depuis le ${formatDateFr(lease.depositReceivedOn)}` : 'Non reçu'}</span>
      </StatCard>
      <StatCard label="Retenues estimées" value={money(withheld)}>
        <span className="text-caption text-fg-subtle">Réparations imputables</span>
      </StatCard>
      <StatCard label="À restituer" value={money(toReturn)}>
        <span className="text-caption text-fg-subtle">{exit.depositReturned ? 'Dépôt restitué' : 'Estimation avant l’état des lieux'}</span>
      </StatCard>
    </div>
  );
}

function ExitBody({ lease, exit, onEditNotice }: { lease: Lease; exit: LeaseExit; onEditNotice: (() => void) | undefined }) {
  const lookups = useLeaseLookups();
  const setStep = useSetExitStep(lease.id);
  const markReturned = useMarkReturned(lease.id);
  const notify = useNotify();
  const { push } = useGestionNavigation();
  const [confirming, setConfirming] = useState(false);

  const { deductions, toReturn } = exitFigures(lease, exit);

  const complete = async (step: ExitStep) => {
    try {
      await setStep.mutateAsync({ stepId: step.id, status: 'fait' });
      notify({ title: 'Étape terminée', description: step.title });
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const restore = async () => {
    setConfirming(false);
    const tenantId = lease.tenantIds[0] ?? '';
    try {
      const attestation = await markReturned.mutateAsync({ tenantName: lookups.tenantName(tenantId), tenantCivility: lookups.tenantCivility(tenantId) });
      noticeAfterNavigation({ title: 'Dépôt marqué comme restitué', description: `Attestation ${attestation.number} générée.` });
      push(courriersPaths.attestation(attestation.id));
    } catch (error) {
      notify({ tone: 'danger', title: 'Restitution impossible', description: errorMessage(error) });
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <SectionCard id="sortie-etapes" title="Étapes de la sortie">
          <ol className="flex flex-col">
            {exit.steps.map((step, index) => (
              <li key={step.id} className="flex flex-wrap items-center gap-2.5 border-t border-line py-2 first:border-t-0">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-fg-muted">{step.status === 'fait' ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-body-strong text-fg">{step.title}</b>
                  <span className="text-caption text-fg-subtle">{step.detail}</span>
                </span>
                <Badge tone={stepBadge[step.status].tone}>{stepBadge[step.status].label}</Badge>
                {step.status !== 'fait' && !exit.depositReturned && step.id !== 'restitution' && step.id !== 'cloture' ? (
                  <Button variant="secondary" size="sm" loading={setStep.isPending && setStep.variables.stepId === step.id} onClick={() => { void complete(step); }}>
                    Marquer comme fait
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard id="sortie-chiffrage" title="Réparations locatives, comparaison avec l’entrée">
          {exit.repairs.length === 0 ? (
            <p className="text-body text-fg-subtle">Aucune dégradation relevée pour le moment.</p>
          ) : (
            <Table aria-label="Réparations">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Élément</TableHeaderCell>
                  <TableHeaderCell>État d’entrée</TableHeaderCell>
                  <TableHeaderCell>Relevé en pré-visite</TableHeaderCell>
                  <TableHeaderCell>Imputation</TableHeaderCell>
                  <TableHeaderCell numeric>Estimation</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exit.repairs.map((repair) => (
                  <TableRow key={repair.id}>
                    <TableCell strong>{repair.element}</TableCell>
                    <TableCell>{repair.entryState}</TableCell>
                    <TableCell>{repair.preVisit}</TableCell>
                    <TableCell>{repair.imputation === 'degradation' ? 'Dégradation' : 'Propriétaire'}</TableCell>
                    <TableCell numeric>{money(repair.estimate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
      <aside className="flex min-w-0 flex-col gap-3">
        <SectionCard
          id="sortie-preavis"
          title="Préavis"
          aside={onEditNotice ? <Button variant="ghost" size="sm" onClick={onEditNotice}>Modifier</Button> : undefined}
        >
          <DescriptionList
            termWidth="110px"
            items={[
              { term: 'Reçu le', detail: formatDateFr(exit.noticeReceivedOn) },
              { term: 'Mode', detail: exit.noticeKind },
              { term: 'Durée applicable', detail: exit.noticeDuration },
              { term: 'Départ prévu', detail: formatDateFr(exit.departure) },
              { term: 'Dernière échéance', detail: monthLabel(exit.lastInstallment) },
              { term: 'Motif', detail: exit.reason === '' ? 'Non précisé' : exit.reason },
            ]}
          />
        </SectionCard>
        <SectionCard id="sortie-depot" title="Décompte du dépôt">
          <LedgerLines
            lines={[
              { label: 'Dépôt de garantie', value: money(lease.deposit) },
              { label: 'Réparations imputables', value: deductions === 0 ? money(0) : money(-deductions) },
              { label: 'Loyers et charges impayés', value: exit.unpaid === 0 ? money(0) : money(-exit.unpaid) },
              { label: `Régularisation des charges ${exit.departure.slice(0, 4)}`, value: exit.chargesRegularisation === 0 ? money(0) : money(-exit.chargesRegularisation) },
            ]}
            total={{ label: 'À restituer', value: money(toReturn) }}
          />
          {exit.depositReturned ? null : <p className="text-caption text-fg-subtle">Après l’état des lieux, le décompte est définitif.</p>}
          {exit.depositReturned && exit.attestationId ? (
            <Alert tone="success" title="Dépôt restitué">
              <div className="mt-1"><LinkButton href={courriersPaths.attestation(exit.attestationId)} size="sm">Voir l’attestation</LinkButton></div>
            </Alert>
          ) : (
            <Button loading={markReturned.isPending} onClick={() => { setConfirming(true); }}>Marquer comme restitué</Button>
          )}
        </SectionCard>
      </aside>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Marquer le dépôt comme restitué ?"
        description={`${money(toReturn)} seront restitués. Le bail sera clôturé et l’attestation de restitution générée. Cette action est définitive.`}
        confirmLabel="Marquer comme restitué"
        onConfirm={() => { void restore(); }}
      />
    </div>
  );
}
