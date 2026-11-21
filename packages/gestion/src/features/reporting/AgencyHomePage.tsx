'use client';

import { Badge, Button, Icon, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Handshake, Landmark, ScrollText, ShieldCheck } from 'lucide-react';
import { useShellData } from '@eguardimmo/shell';
import { AgingPanel, ArrearsStat, RentCollectedStat, StatSlot } from './HomeCards';
import { useAgencyAlerts, useAgencyKpis, useAgencyPayouts, usePartyNames, useReportingPermissions } from './hooks';
import { moneyText, periodText, plural } from './labels';
import { reportingPaths } from './paths';
import { CardState } from './parts';
import { ItemRow, NoRows, SectionCard, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';

export function AgencyHomePage() {
  const { Link } = useGestionNavigation();
  const shell = useShellData();
  const permissions = useReportingPermissions();
  const firstName = shell.data?.user.firstName;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title">{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h1>
          <p className="mt-0.5 text-body text-fg-muted">{shell.data?.workspace.name ?? ' '}</p>
        </div>
        {permissions.agency ? (
          <Button variant="secondary" asChild>
            <Link href={reportingPaths.generate}>
              <Icon icon={ScrollText} />
              Générer les comptes rendus
            </Link>
          </Button>
        ) : null}
      </div>
      <KpiRow />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PayoutsPanel />
        <AlertsPanel />
      </div>
      <SectionCard id="accueil-impayes" title="Impayés par ancienneté">
        <AgingPanel />
      </SectionCard>
    </>
  );
}

function KpiRow() {
  const kpis = useAgencyKpis();
  const payouts = useAgencyPayouts();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatSlot label="Loyers encaissés" query={kpis} failure="Les loyers du mois n’ont pas pu être chargés">
        {kpis.data ? <RentCollectedStat card={kpis.data} /> : null}
      </StatSlot>
      <StatSlot label="Honoraires du mois" query={kpis} failure="Les honoraires du mois n’ont pas pu être chargés">
        {kpis.data ? (
          <StatCard label="Honoraires du mois" value={moneyText(kpis.data.feesNet)}>
            <span className="text-caption text-fg-subtle">{kpis.data.periodClosed ? 'Mois clos en comptabilité' : 'Mois non encore clos'}</span>
          </StatCard>
        ) : null}
      </StatSlot>
      <StatSlot label="Reversements en attente" query={payouts} failure="Les reversements n’ont pas pu être chargés">
        {payouts.data ? (
          <StatCard label="Reversements en attente" value={moneyText(payouts.data.payableTotal)}>
            <span className="text-caption text-fg-subtle">{plural(payouts.data.mandantsWithPayable, 'mandant', 'mandants')}</span>
          </StatCard>
        ) : null}
      </StatSlot>
      <ArrearsStat />
    </div>
  );
}

function PayoutsPanel() {
  const { Link } = useGestionNavigation();
  const payouts = useAgencyPayouts();
  const names = usePartyNames(payouts.data?.topMandants.map((mandant) => mandant.partyId) ?? []);
  return (
    <SectionCard
      id="accueil-reversements"
      title="Reversements"
      aside={<Button variant="link" asChild><Link href={reportingPaths.payouts}>Tout voir</Link></Button>}
    >
      <CardState query={payouts} loading="Chargement des reversements" failure="Les reversements n’ont pas pu être chargés">
        {payouts.data ? (
          <>
            <p className="text-caption text-fg-subtle">
              {`En cours de virement : ${moneyText(payouts.data.inTransitTotal)} · ${plural(payouts.data.pendingItems, 'virement à exécuter', 'virements à exécuter')} · ${plural(payouts.data.activeHolds, 'retenue active', 'retenues actives')}`}
            </p>
            {payouts.data.topMandants.length === 0 ? (
              <NoRows>Aucun mandant n’a de solde à reverser.</NoRows>
            ) : (
              <Table aria-label="Principaux soldes à reverser">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Mandant</TableHeaderCell>
                    <TableHeaderCell numeric>Dû au mandant</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payouts.data.topMandants.map((mandant) => (
                    <TableRow key={mandant.partyId}>
                      <TableCell strong>
                        <Link href={reportingPaths.mandant(mandant.partyId)} className="text-action-on-subtle underline-offset-2 hover:underline">{names(mandant.partyId, mandant.name)}</Link>
                      </TableCell>
                      <TableCell numeric>{moneyText(mandant.payable)}</TableCell>
                      <TableCell><Badge tone="info">À reverser</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : null}
      </CardState>
    </SectionCard>
  );
}

function AlertsPanel() {
  const { Link } = useGestionNavigation();
  const alerts = useAgencyAlerts();
  const names = usePartyNames(alerts.data?.reportsDue.mandantIds ?? []);
  return (
    <SectionCard id="accueil-a-traiter" title="À traiter">
      <CardState query={alerts} loading="Chargement des alertes" failure="Les alertes n’ont pas pu être chargées">
        {alerts.data ? (
          <ul>
            <ItemRow
              icon={ScrollText}
              tone={alerts.data.reportsDue.count > 0 ? 'warning' : 'success'}
              title={<Link href={reportingPaths.generate} className="hover:underline">{plural(alerts.data.reportsDue.count, 'compte rendu à générer', 'comptes rendus à générer')}</Link>}
              detail={
                alerts.data.reportsDue.count === 0
                  ? periodText(alerts.data.reportsDue.period)
                  : `${periodText(alerts.data.reportsDue.period)} · ${alerts.data.reportsDue.mandantIds.map((id) => names(id)).join(', ')}${alerts.data.reportsDue.count > alerts.data.reportsDue.mandantIds.length ? '…' : ''}`
              }
            />
            <ItemRow
              icon={Handshake}
              tone={alerts.data.mandatesToRenew.count > 0 ? 'warning' : 'success'}
              title={<Link href={`${reportingPaths.mandates}?etat=a_renouveler`} className="hover:underline">{plural(alerts.data.mandatesToRenew.count, 'mandat à renouveler', 'mandats à renouveler')}</Link>}
              detail={alerts.data.mandatesToRenew.next.length === 0 ? 'Aucun mandat n’arrive à échéance.' : `Prochain : ${alerts.data.mandatesToRenew.next[0]?.reference ?? ''}, le ${formatDateFr(alerts.data.mandatesToRenew.next[0]?.endsOn)}`}
            />
            <ItemRow
              icon={ShieldCheck}
              tone={alerts.data.certificatesToRenew > 0 ? 'warning' : 'success'}
              title={<Link href={reportingPaths.conformity} className="hover:underline">{plural(alerts.data.certificatesToRenew, 'pièce de conformité à renouveler', 'pièces de conformité à renouveler')}</Link>}
            />
            <ItemRow icon={Landmark} tone="neutral" title={<Link href={reportingPaths.arrears} className="hover:underline">Impayés et recouvrement</Link>} />
          </ul>
        ) : null}
      </CardState>
    </SectionCard>
  );
}
