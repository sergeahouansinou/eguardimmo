'use client';

import { CalendarClock, CircleAlert, FileText, LogOut, Pencil } from 'lucide-react';
import { Alert, Card, StatCard, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { useState } from 'react';
import { LeaseStatusBadge, leasePeriod, useLeaseLookups } from './BauxParts';
import { LeaseGate } from './LeaseGate';
import { useEdls, useExits, useInstallments, useLeaseExtras } from './hooks';
import { bauxPaths } from './paths';
import { edlTypeLabel, paymentMethodLabel } from './schemas';
import type { Lease } from './schemas';
import { DescriptionList, ItemRow, LinkButton, ListLoading, LoadError, NoRows, PageHeader, SectionCard, useGestionNavigation } from '../locataires/kit';
import { daysBetween, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { locatairesPaths } from '../locataires/paths';

export function BailDetailPage({ id }: { id: string }) {
  return <LeaseGate id={id} title="Bail">{(lease) => <LeaseSheet lease={lease} />}</LeaseGate>;
}

function LeaseSheet({ lease }: { lease: Lease }) {
  const lookups = useLeaseLookups();
  const { Link } = useGestionNavigation();
  const extras = useLeaseExtras(lease.id);
  const edls = useEdls();
  const exits = useExits();
  const installments = useInstallments(lease.id);
  const [tab, setTab] = useState('resume');

  const exit = exits.data?.find((entry) => entry.leaseId === lease.id);
  const unitEdls = (edls.data ?? []).filter((edl) => edl.unitId === lease.unitId && !edl.archived);
  const nextNotice = installments.data?.find((row) => row.state === 'a_emettre');
  const remaining = daysBetween(todayIso(), lease.end);
  const canExit = lease.status === 'en_cours' || lease.status === 'preavis';

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: lease.reference }]}
        title={`Bail ${lease.reference}`}
        badges={<LeaseStatusBadge status={lease.status} />}
        subtitle={`${lookups.unitLabel(lease.unitId)}, ${lookups.tenantsOf(lease)}`}
        actions={
          <>
            {lease.status !== 'termine' ? <LinkButton href={bauxPaths.edit(lease.id)} icon={Pencil}>Modifier</LinkButton> : null}
            {lease.status !== 'brouillon' ? <LinkButton href={bauxPaths.schedule(lease.id)} icon={CalendarClock}>Échéancier</LinkButton> : null}
            {canExit || lease.status === 'termine' ? <LinkButton href={bauxPaths.exit(lease.id)} icon={LogOut}>{lease.status === 'termine' ? 'Voir la sortie' : 'Préavis et sortie'}</LinkButton> : null}
          </>
        }
      />

      {lease.balance < 0 ? (
        <Alert tone="danger" title={`${money(-lease.balance)} d’impayé sur ce bail.`}>
          <div className="mt-1 flex flex-wrap gap-2">
            <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: lease.tenantIds[0], bien: lease.unitId })} variant="primary" size="sm">Relancer</LinkButton>
            <LinkButton href={links.newPayment({ locataire: lease.tenantIds[0] })} size="sm">Enregistrer un paiement</LinkButton>
          </div>
        </Alert>
      ) : null}
      {lease.status === 'preavis' && exit ? (
        <Alert tone="warning" title={`Préavis reçu le ${formatDateFr(exit.noticeReceivedOn)}, départ le ${formatDateFr(exit.departure)}.`}>
          <div className="mt-1"><LinkButton href={bauxPaths.exit(lease.id)} size="sm">Suivre la sortie</LinkButton></div>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Loyer charges comprises" value={money(lease.rent + lease.charges)}>
          <span className="text-caption text-fg-subtle">{`${money(lease.rent)} + ${money(lease.charges)} de charges`}</span>
        </StatCard>
        <StatCard label="Solde du compte" value={money(lease.balance)} tone={lease.balance < 0 ? 'danger' : 'default'}>
          <span className="text-caption text-fg-subtle">{lease.balance < 0 ? 'Loyer en retard' : 'À jour'}</span>
        </StatCard>
        <StatCard label="Fin du bail" value={formatDateFr(lease.end)}>
          <span className="text-caption text-fg-subtle">
            {lease.status === 'termine' ? 'Bail terminé' : remaining >= 0 ? `Dans ${String(remaining)} jours` : 'Date dépassée'}
          </span>
        </StatCard>
      </div>

      <Card role="region" aria-label="Détail du bail" className="gap-3">
        <Tabs value={tab} onValueChange={setTab} defaultValue="resume">
          <TabList aria-label="Sections du bail">
            <Tab value="resume">Résumé</Tab>
            <Tab value="documents" count={extras.data?.documents.length ?? 0}>Documents</Tab>
            <Tab value="edl" count={unitEdls.length}>États des lieux</Tab>
            <Tab value="historique" count={extras.data?.history.length ?? 0}>Historique</Tab>
          </TabList>
          <TabPanel value={tab} className="pt-2">
            {extras.isError ? <LoadError title="Le détail du bail n’a pas pu être chargé" /> : null}
            {extras.isPending ? <ListLoading label="Chargement du bail" /> : null}
            {extras.data && tab === 'resume' ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <SectionCard id="bail-conditions" title="Conditions">
                  <DescriptionList
                    termWidth="140px"
                    items={[
                      { term: 'Bien', detail: <Link href={links.unit(lease.unitId)} className="underline-offset-2 hover:underline">{lookups.unitLabel(lease.unitId)}</Link> },
                      {
                        term: lease.tenantIds.length > 1 ? 'Locataires' : 'Locataire',
                        detail:
                          lease.tenantIds.length === 0
                            ? 'Aucun locataire'
                            : lease.tenantIds.map((tenantId, index) => (
                                <span key={tenantId}>
                                  {index > 0 ? ', ' : ''}
                                  <Link href={locatairesPaths.detail(tenantId)} className="underline-offset-2 hover:underline">{lookups.tenantName(tenantId)}</Link>
                                </span>
                              )),
                      },
                      { term: 'Période', detail: leasePeriod(lease) },
                      { term: 'Durée', detail: `${String(lease.durationMonths)} mois, ${lease.legalNote}` },
                      { term: 'Reconduction', detail: lease.tacitNote },
                      { term: 'Dépôt de garantie', detail: `${money(lease.deposit)}${lease.depositReceivedOn ? `, reçu le ${formatDateFr(lease.depositReceivedOn)}` : ', non reçu'}` },
                    ]}
                  />
                </SectionCard>
                <SectionCard id="bail-paiement" title="Paiement et révision">
                  <DescriptionList
                    termWidth="140px"
                    items={[
                      { term: 'Échéance', detail: `Le ${String(lease.dueDay)} de chaque mois` },
                      { term: 'Mode de paiement', detail: paymentMethodLabel[lease.paymentMethod] },
                      { term: 'Prochain avis', detail: nextNotice ? `${money(nextNotice.called)}, ${formatDateFr(nextNotice.due)}` : '—' },
                      { term: 'Révision', detail: lease.nextRevision ? `${lease.revisionIndex}, le ${formatDateFr(lease.nextRevision)}` : '—' },
                      { term: 'Encadrement', detail: lease.rentControl === '' ? 'Non concerné' : lease.rentControl },
                      { term: 'Garant', detail: lease.guarantor ?? 'Aucun' },
                    ]}
                  />
                </SectionCard>
                <SectionCard id="bail-actions" title="Actions à venir">
                  {extras.data.actions.length === 0 ? (
                    <NoRows>Aucune action en attente.</NoRows>
                  ) : (
                    <ul>
                      {extras.data.actions.map((action) => (
                        <ItemRow key={action.id} icon={CircleAlert} tone={action.tone} title={action.title} detail={action.detail} badge={action.badge} />
                      ))}
                    </ul>
                  )}
                </SectionCard>
                {lease.note === '' ? null : (
                  <SectionCard id="bail-note" title="Note">
                    <p className="text-body text-fg-muted">{lease.note}</p>
                  </SectionCard>
                )}
              </div>
            ) : null}
            {extras.data && tab === 'documents' ? (
              <SectionCard
                id="bail-documents"
                title="Documents du bail"
                aside={<LinkButton href="/documents" size="sm" variant="ghost">Tous les documents</LinkButton>}
              >
                <ul>
                  {extras.data.documents.map((document) => (
                    <ItemRow key={document.id} icon={FileText} tone={document.tone} title={document.title} detail={document.detail} badge={document.badge} />
                  ))}
                  {exit?.attestationId ? (
                    <ItemRow
                      icon={FileText}
                      title="Attestation de restitution du dépôt"
                      detail="Générée à la sortie du locataire"
                      trailing={<LinkButton href={`/documents/attestations/${exit.attestationId}`} size="sm">Ouvrir</LinkButton>}
                    />
                  ) : null}
                </ul>
              </SectionCard>
            ) : null}
            {tab === 'edl' ? (
              <SectionCard
                id="bail-edl"
                title="États des lieux du bien"
                aside={<LinkButton href={`${bauxPaths.newEdl}?bien=${lease.unitId}`} size="sm">Nouvel état des lieux</LinkButton>}
              >
                {edls.isPending ? <ListLoading label="Chargement des états des lieux" /> : null}
                {edls.data && unitEdls.length === 0 ? <NoRows>Aucun état des lieux pour ce bien.</NoRows> : null}
                <ul>
                  {unitEdls.map((edl) => (
                    <ItemRow
                      key={edl.id}
                      icon={FileText}
                      title={<Link href={bauxPaths.edl(edl.id)} className="hover:underline">{`${edl.reference}, ${edlTypeLabel[edl.type]}`}</Link>}
                      detail={edl.date ? formatDateFr(edl.date) : 'Date à planifier'}
                      badge={{ label: edl.status === 'signe' ? 'Signé' : edl.status === 'prevu' ? 'Prévu' : edl.status === 'a_planifier' ? 'À planifier' : 'Brouillon', tone: edl.status === 'signe' ? 'success' : edl.status === 'brouillon' ? 'neutral' : 'info' }}
                    />
                  ))}
                </ul>
              </SectionCard>
            ) : null}
            {extras.data && tab === 'historique' ? (
              <SectionCard id="bail-historique" title="Historique">
                {extras.data.history.length === 0 ? <NoRows>Aucun événement enregistré.</NoRows> : null}
                <ul>
                  {extras.data.history.map((entry) => (
                    <ItemRow key={entry.id} icon={CalendarClock} tone={entry.tone} title={entry.title} detail={entry.detail} />
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </TabPanel>
        </Tabs>
      </Card>
    </>
  );
}
