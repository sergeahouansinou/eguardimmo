'use client';

import { Badge, Button, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs } from '@eguardimmo/ui';
import type { Tone } from '@eguardimmo/shell';
import { CircleAlert, CircleCheck, Clock, FileText, FilePenLine, Info, Mail, MessageSquare, Pencil, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { TenantAvatar, TenantStateBadge, tenantKindLabel } from './TenantParts';
import { useTenantDetail, useTenants, useUnits } from './hooks';
import { DescriptionList, ItemRow, LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader, SectionCard } from './kit';
import { daysBetween, formatDateFr, todayIso } from './kit/dates';
import { links } from './kit/links';
import { money } from './kit/money';
import { locatairesPaths } from './paths';
import { tenantNameOf, unitFullLabel } from './schemas';
import type { Tenant, TenantDetail } from './schemas';

const toneIcon: Record<Tone, LucideIcon> = {
  danger: CircleAlert,
  warning: Clock,
  success: CircleCheck,
  info: Info,
  neutral: Mail,
};

function untilLabel(end: string): string {
  const total = Math.max(0, daysBetween(todayIso(), end));
  const months = Math.floor(total / 30.4375);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 ? `${String(years)} an${years > 1 ? 's' : ''}` : '', rest > 0 ? `${String(rest)} mois` : ''].filter(Boolean);
  return parts.length === 0 ? `Dans ${String(total)} jours` : `Dans ${parts.join(' et ')}`;
}

export function LocataireDetailPage({ id }: { id: string }) {
  const tenants = useTenants();
  const detail = useTenantDetail(id);
  const units = useUnits();
  const [tab, setTab] = useState('apercu');
  const tenant = tenants.data?.find((entry) => entry.id === id);

  if (tenants.isError || detail.isError) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: 'Fiche locataire' }]} title="Fiche locataire" />
        <LoadError title="La fiche n’a pas pu être chargée" />
      </>
    );
  }
  if (tenants.data && !tenant) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: 'Introuvable' }]} title="Locataire introuvable" />
        <NotFoundPanel title="Ce locataire n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={locatairesPaths.list} backLabel="Retour aux locataires" />
      </>
    );
  }
  if (!tenant || !detail.data) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: 'Fiche locataire' }]} title="Fiche locataire" />
        <ListLoading label="Chargement de la fiche locataire" />
      </>
    );
  }

  const unit = units.data?.find((entry) => entry.id === tenant.unitId);
  return <TenantSheet tenant={tenant} detail={detail.data} unitLabel={unit ? unitFullLabel(unit) : null} tab={tab} onTab={setTab} />;
}

function TenantSheet({ tenant, detail, unitLabel, tab, onTab }: { tenant: Tenant; detail: TenantDetail; unitLabel: string | null; tab: string; onTab: (tab: string) => void }) {
  const name = tenantNameOf(tenant);
  const rate = detail.onTime.total > 0 ? Math.round((detail.onTime.onTime / detail.onTime.total) * 100) : null;
  const unpaid = detail.payments.filter((payment) => payment.status === 'impaye').length;

  const seeAll = (target: string, count: number) => (
    <Button variant="link" size="sm" onClick={() => { onTab(target); }}>
      {`Tout voir, ${String(count)}`}
    </Button>
  );

  const paymentsTable = (
    <Table aria-label="Paiements du locataire">
      <TableHead>
        <tr>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Libellé</TableHeaderCell>
          <TableHeaderCell numeric>Montant</TableHeaderCell>
          <TableHeaderCell>État</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {detail.payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell numeric>{formatDateFr(payment.date)}</TableCell>
            <TableCell strong>{payment.label}</TableCell>
            <TableCell numeric>{payment.amount === null ? '—' : money(payment.amount)}</TableCell>
            <TableCell>
              <Badge tone={payment.status === 'impaye' ? 'danger' : payment.status === 'paye' ? 'success' : 'warning'}>
                {payment.status === 'impaye' ? 'Impayé' : payment.status === 'paye' ? 'Payé' : 'Partiel'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const paymentsSection = (
    <SectionCard
      id="loc-paiements"
      title="Derniers paiements"
      aside={
        <div className="flex items-center gap-3">
          <LinkButton href={links.newPayment({ locataire: tenant.id })} variant="link" size="sm">Encaisser</LinkButton>
          {tab === 'apercu' ? seeAll('paiements', detail.paymentsCount) : null}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 text-caption text-fg-muted">
        <Badge>{`${String(detail.paymentsCount + unpaid)} échéances`}</Badge>
        <Badge>{`${String(detail.lateSettled)} réglées en retard`}</Badge>
        <Badge tone={unpaid > 0 ? 'danger' : 'neutral'}>{unpaid > 0 ? `${String(unpaid)} impayée${unpaid > 1 ? 's' : ''}, ${money(-tenant.balance)}` : 'Aucune impayée'}</Badge>
      </div>
      {detail.payments.length === 0 ? <p className="py-3 text-body text-fg-subtle">Aucun paiement enregistré.</p> : paymentsTable}
    </SectionCard>
  );

  const contactSection = (
    <SectionCard id="loc-coordonnees" title="Coordonnées" aside={<LinkButton href={locatairesPaths.edit(tenant.id)} variant="link" size="sm">Modifier</LinkButton>}>
      <DescriptionList
        termWidth="90px"
        items={[
          { term: 'Mobile', detail: tenant.phone || '—' },
          { term: 'E-mail', detail: tenant.email || '—' },
          { term: 'Adresse', detail: tenant.address || '—' },
          { term: 'Profession', detail: tenant.profession || '—' },
          { term: 'Banque', detail: tenant.ibanLast4 ? `IBAN •••• ${tenant.ibanLast4}` : '—' },
        ]}
      />
    </SectionCard>
  );

  const activitiesSection = (
    <SectionCard id="loc-activites" title="Dernières activités" aside={detail.activitiesCount > 0 ? <span className="text-caption text-fg-subtle">{`${String(detail.activitiesCount)} au total`}</span> : null}>
      {detail.activities.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">Aucune activité récente.</p>
      ) : (
        <ul>{detail.activities.map((row) => <ItemRow key={row.id} icon={toneIcon[row.tone]} tone={row.tone} title={row.title} detail={row.detail} badge={row.badge} />)}</ul>
      )}
    </SectionCard>
  );

  const documentsSection = (
    <SectionCard id="loc-dossier" title="Dossier du locataire" aside={tab === 'apercu' ? seeAll('documents', detail.documentsCount) : null}>
      {detail.documents.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">Aucun document dans le dossier.</p>
      ) : (
        <ul>{detail.documents.map((row) => <ItemRow key={row.id} icon={FileText} tone={row.tone} title={row.title} detail={row.detail} />)}</ul>
      )}
    </SectionCard>
  );

  const leasesSection = (
    <SectionCard id="loc-baux" title="Baux" aside={tab === 'apercu' ? seeAll('baux', detail.leases.length) : null}>
      {detail.leases.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">Aucun bail pour ce locataire.</p>
      ) : (
        <ul>
          {detail.leases.map((row) => (
            <ItemRow
              key={row.id}
              icon={FilePenLine}
              tone={row.tone}
              title={row.title}
              detail={row.detail}
              badge={row.badge}
              trailing={<LinkButton href={row.href} variant="link" size="sm">Ouvrir</LinkButton>}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );

  const messagesSection = (
    <SectionCard id="loc-messages" title="Derniers messages" aside={tab === 'apercu' ? seeAll('messages', detail.messagesCount) : <LinkButton href={links.newMessage(tenant.id)} variant="link" size="sm">Écrire</LinkButton>}>
      {detail.messages.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">Aucun message échangé.</p>
      ) : (
        <ul>{detail.messages.map((row) => <ItemRow key={row.id} icon={MessageSquare} tone={row.tone} title={row.title} detail={row.detail} badge={row.badge} />)}</ul>
      )}
    </SectionCard>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: name }]}
        lead={<TenantAvatar tenant={tenant} size="lg" />}
        title={name}
        badges={
          <>
            <TenantStateBadge state={tenant.state} />
            {tenant.portalActive ? <Badge tone="success">Espace locataire actif</Badge> : tenant.portalInvitedOn ? <Badge tone="info">Invitation portail envoyée</Badge> : null}
          </>
        }
        subtitle={`${tenantKindLabel(tenant.kind)} · Locataire depuis le ${formatDateFr(tenant.since)}${unitLabel ? ` · ${unitLabel}` : ''}`}
        actions={
          <>
            <LinkButton href={links.newMessage(tenant.id)} icon={Send}>Écrire</LinkButton>
            <LinkButton href={locatairesPaths.edit(tenant.id)} icon={Pencil}>Modifier</LinkButton>
            {tenant.state === 'retard' ? (
              <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: tenant.id })} variant="primary" icon={Mail}>
                Relancer
              </LinkButton>
            ) : null}
          </>
        }
      />

      <Tabs value={tab} onValueChange={onTab} defaultValue="apercu">
        <TabList aria-label="Sections de la fiche locataire">
          <Tab value="apercu">Vue d’ensemble</Tab>
          <Tab value="baux" count={detail.leases.length}>Baux</Tab>
          <Tab value="paiements" count={detail.paymentsCount}>Paiements</Tab>
          <Tab value="documents" count={detail.documentsCount}>Documents</Tab>
          <Tab value="messages" count={detail.messagesCount}>Messages</Tab>
        </TabList>
        <TabPanel value={tab} className="flex flex-col gap-3 pt-2">
          {tab === 'apercu' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Solde du compte" tone={tenant.balance < 0 ? 'danger' : 'default'} value={money(tenant.balance)}>
                  <span className="text-caption text-fg-subtle">{detail.dueSince && tenant.balance < 0 ? `Échéance du ${formatDateFr(detail.dueSince)}` : 'Compte à jour'}</span>
                </StatCard>
                <StatCard label="Loyer charges comprises" value={detail.rent > 0 ? `${money(detail.rent)} par mois` : '—'}>
                  <span className="text-caption text-fg-subtle">{detail.nextNoticeOn ? `Prochain avis le ${formatDateFr(detail.nextNoticeOn)}` : 'Aucun bail en cours'}</span>
                </StatCard>
                <StatCard label="Paiements à l'heure" value={rate === null ? '—' : `${String(rate)} %`}>
                  <span className="text-caption text-fg-subtle">{rate === null ? 'Pas encore d’échéance' : `${String(detail.onTime.onTime)} échéances sur ${String(detail.onTime.total)}`}</span>
                </StatCard>
                <StatCard label="Fin du bail" value={detail.leaseEnd ? formatDateFr(detail.leaseEnd) : '—'}>
                  <span className="text-caption text-fg-subtle">{detail.leaseEnd ? untilLabel(detail.leaseEnd) : 'Aucun bail en cours'}</span>
                </StatCard>
              </div>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {paymentsSection}
                {contactSection}
              </div>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                {activitiesSection}
                {documentsSection}
              </div>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                {leasesSection}
                {messagesSection}
              </div>
            </>
          ) : null}
          {tab === 'baux' ? leasesSection : null}
          {tab === 'paiements' ? paymentsSection : null}
          {tab === 'documents' ? documentsSection : null}
          {tab === 'messages' ? messagesSection : null}
        </TabPanel>
      </Tabs>
    </>
  );
}
