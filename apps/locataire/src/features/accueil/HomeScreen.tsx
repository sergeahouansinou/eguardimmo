'use client';

import { useShellData } from '@eguardimmo/shell';
import { Alert, Button, Icon, StatCard } from '@eguardimmo/ui';
import { ClipboardCheck, CircleCheck, Clock, CreditCard, FileSignature, Mail, MessageSquare, ShieldCheck, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Async, Async2, Async3 } from '@/components/ScreenState';
import { PageHeader } from '@/components/PageHeader';
import { CardLink, EmptyLine, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useAttestations, useDocuments, useHome, useInstallments, useInterventions, useLease } from '@/data/queries';
import type { DemoDocument } from '@/data/schemas/logement';
import type { Installment } from '@/data/schemas/loyers';
import { daysBetween, formatDate, monthName, monthOf, plural } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatMoney } from '@/lib/money';
import { insuranceView } from '../assurance/insurance';
import { installmentStatus, interventionStatus } from '../shared/status';

const total = (item: Installment) => item.rentCents + item.provisionsCents;
const HOME_DOCUMENT_IDS = ['bail-signe', 'etat-des-lieux-d-entree', 'attestation-d-assurance'] as const;

export function HomeScreen() {
  const shell = useShellData();
  const lease = useLease();
  const installments = useInstallments();
  const home = useHome();
  const firstName = shell.data?.user.firstName;
  return (
    <>
      <Async2 a={lease} b={home} errorTitle="Votre accueil n’a pas pu être chargé">
        {(leaseData) => (
          <PageHeader
            title={firstName ? `Bonjour ${firstName}` : 'Bonjour'}
            subtitle={`${leaseData.property.unit}, ${leaseData.property.street}, ${leaseData.property.postalCode} ${leaseData.property.city} · Bail du ${formatDate(leaseData.startOn)} au ${formatDate(leaseData.endOn)}`}
            actions={
              <>
                <Button variant="secondary" asChild>
                  <Link href="/interventions/nouvelle">
                    <Icon icon={Wrench} />
                    Signaler un problème
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/loyers/payer">
                    <Icon icon={CreditCard} />
                    Payer mon loyer
                  </Link>
                </Button>
              </>
            }
          />
        )}
      </Async2>
      <Async3 a={installments} b={lease} c={home} errorTitle="Vos loyers n’ont pas pu être chargés">
        {(items, leaseData, homeData) => <Summary items={items} leaseData={leaseData} today={homeData.today} note={homeData.arrearsNote} />}
      </Async3>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PaymentsCard />
        <LogementCard />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <RequestsCard />
        <MessagesCard />
      </div>
      <DocumentsCard />
    </>
  );
}

function Summary({
  items,
  leaseData,
  today,
  note,
}: {
  items: Installment[];
  leaseData: { depositCents: number; depositPaidOn: string; endOn: string; renewal: string };
  today: string;
  note: string;
}) {
  const unpaid = items.filter((item) => item.status === 'impaye');
  const oldest = unpaid[0];
  const amountDue = unpaid.reduce((sum, item) => sum + total(item), 0);
  const next = items.find((item) => item.status === 'a_venir');
  return (
    <>
      {oldest ? (
        <Alert tone="danger" title={`Loyer de ${monthName(oldest.id)}, ${formatMoney(amountDue)} à régler`}>
          Échéance du {formatDate(oldest.dueOn)}, retard de {plural(daysBetween(oldest.dueOn, today), 'jour', 'jours')}. {note}
          <div className="mt-1.5">
            <Button size="sm" variant="danger" asChild>
              <Link href="/loyers/payer">Payer {formatMoney(amountDue)}</Link>
            </Button>
          </div>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reste à payer" value={formatMoney(amountDue)} tone={amountDue > 0 ? 'danger' : 'default'}>
          <span className="text-caption text-fg-subtle">{oldest ? `Échéance du ${formatDate(oldest.dueOn)}` : 'Aucun loyer en attente'}</span>
        </StatCard>
        <StatCard label="Prochain avis" value={next ? formatDate(next.dueOn) : '—'}>
          <span className="text-caption text-fg-subtle">{next ? `${formatMoney(total(next))} charges comprises` : 'Aucune échéance à venir'}</span>
        </StatCard>
        <StatCard label="Fin du bail" value={formatDate(leaseData.endOn)}>
          <span className="text-caption text-fg-subtle">{leaseData.renewal}</span>
        </StatCard>
        <StatCard label="Dépôt de garantie" value={formatMoney(leaseData.depositCents)}>
          <span className="text-caption text-fg-subtle">Versé le {formatDate(leaseData.depositPaidOn)}</span>
        </StatCard>
      </div>
    </>
  );
}

function PaymentsCard() {
  const installments = useInstallments();
  return (
    <SectionCard
      id="accueil-paiements"
      title="Mes derniers paiements"
      aside={
        <CardLink href="/loyers">
          Tout voir{installments.data ? `, ${String(installments.data.filter((item) => item.status === 'paye').length)}` : ''}
        </CardLink>
      }
    >
      <Async query={installments} errorTitle="Les paiements n’ont pas pu être chargés" rows={1}>
        {(items) => {
          const recent = items.filter((item) => item.status !== 'a_venir').slice(-3).reverse();
          if (recent.length === 0) return <EmptyLine>Aucun paiement pour le moment.</EmptyLine>;
          return (
            <ul>
              {recent.map((item) => {
                const view = installmentStatus(item.status);
                const label = `Échéance ${monthOf(item.id)}`;
                const detail =
                  item.status === 'impaye'
                    ? `${formatMoney(total(item))} dus depuis le ${formatDate(item.dueOn)}`
                    : item.status === 'paye' && item.paidOn
                      ? `${formatMoney(total(item))} · payé le ${formatDate(item.paidOn)}`
                      : `${formatMoney(total(item))} · ${view.label.toLowerCase()}`;
                return (
                  <ListRow
                    key={item.id}
                    icon={view.icon}
                    tone={view.tone}
                    title={label}
                    detail={detail}
                    trailing={
                      item.status === 'paye' && item.receiptId ? (
                        <Button variant="link" size="sm" asChild>
                          <Link href={`/loyers/quittances/${item.receiptId}`}>Quittance</Link>
                        </Button>
                      ) : (
                        <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                      )
                    }
                  />
                );
              })}
            </ul>
          );
        }}
      </Async>
    </SectionCard>
  );
}

function LogementCard() {
  const lease = useLease();
  return (
    <SectionCard id="accueil-logement" title="Mon logement">
      <Async query={lease} errorTitle="Le logement n’a pas pu être chargé" rows={1}>
        {(data) => (
          <KeyValueList
            labelWidth="5.5rem"
            items={[
              { label: 'Adresse', value: `${data.property.unit}, ${data.property.street}` },
              { label: 'Type', value: `${data.property.type}, ${data.property.surface}` },
              { label: 'Étage', value: data.property.floorShort },
              { label: 'Bailleur', value: data.landlord.name },
              { label: 'Loyer', value: `${formatMoney(data.rentCents)} + ${formatMoney(data.provisionsCents)} de charges` },
            ]}
          />
        )}
      </Async>
    </SectionCard>
  );
}

function RequestsCard() {
  const interventions = useInterventions();
  return (
    <SectionCard
      id="accueil-demandes"
      title="Mes demandes"
      aside={<CardLink href="/interventions">Tout voir{interventions.data ? `, ${String(interventions.data.length)}` : ''}</CardLink>}
    >
      <Async query={interventions} errorTitle="Les demandes n’ont pas pu être chargées" rows={1}>
        {(items) =>
          items.length === 0 ? (
            <EmptyLine>Aucune demande pour le moment.</EmptyLine>
          ) : (
            <ul>
              {items.slice(0, 3).map((item) => {
                const view = interventionStatus(item.status);
                return (
                  <ListRow
                    key={item.id}
                    icon={item.status === 'terminee' ? CircleCheck : item.status === 'en_cours' ? Wrench : Clock}
                    tone={view.tone}
                    title={item.title}
                    href={`/interventions/${item.id}`}
                    detail={`Signalée le ${formatDate(item.reportedAt)}${item.photos.length > 0 ? ' · photos jointes' : ''}`}
                    trailing={<StatusBadge tone={view.tone}>{view.label}</StatusBadge>}
                  />
                );
              })}
            </ul>
          )
        }
      </Async>
    </SectionCard>
  );
}

function MessagesCard() {
  const home = useHome();
  return (
    <SectionCard
      id="accueil-messages"
      title="Messages"
      aside={<CardLink href="/messages">Tout voir{home.data ? `, ${String(home.data.messages.length)}` : ''}</CardLink>}
    >
      <Async query={home} errorTitle="Les messages n’ont pas pu être chargés" rows={1}>
        {(data) =>
          data.messages.length === 0 ? (
            <EmptyLine>Aucun message.</EmptyLine>
          ) : (
            <ul>
              {data.messages.slice(0, 2).map((message) => (
                <ListRow
                  key={message.id}
                  icon={message.state === 'a_repondre' ? MessageSquare : Mail}
                  tone={message.state === 'a_repondre' ? 'warning' : 'info'}
                  title={message.title}
                  href={`/messages/${message.id}`}
                  detail={`${formatDate(message.date)} · ${message.sender}`}
                  trailing={message.state === 'a_repondre' ? <StatusBadge tone="warning">À répondre</StatusBadge> : null}
                />
              ))}
            </ul>
          )
        }
      </Async>
    </SectionCard>
  );
}

function DocumentsCard() {
  const documents = useDocuments();
  const attestations = useAttestations();
  const home = useHome();
  return (
    <SectionCard
      id="accueil-documents"
      title="Mes documents"
      aside={<CardLink href="/documents">Tout voir{documents.data ? `, ${String(documents.data.length)}` : ''}</CardLink>}
    >
      <Async3 a={documents} b={attestations} c={home} errorTitle="Les documents n’ont pas pu être chargés" rows={1}>
        {(items, attested, homeData) => {
          const insurance = insuranceView(attested, homeData.today);
          const chosen = HOME_DOCUMENT_IDS.map((id) => items.find((item) => item.id === id)).filter(
            (item): item is DemoDocument => item !== undefined,
          );
          return (
            <ul>
              {chosen.map((doc) => {
                const isInsurance = doc.id === 'attestation-d-assurance';
                const renew = isInsurance && insurance.status === 'a_renouveler';
                return (
                  <ListRow
                    key={doc.id}
                    icon={isInsurance ? ShieldCheck : doc.id === 'bail-signe' ? FileSignature : ClipboardCheck}
                    tone={renew ? 'warning' : 'info'}
                    title={doc.name}
                    detail={isInsurance && insurance.current ? `Valable jusqu'au ${formatDate(insurance.current.endOn)}` : (doc.homeDetail ?? doc.detail)}
                    trailing={
                      renew ? (
                        <StatusBadge tone="warning">À renouveler</StatusBadge>
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => { downloadDemoPdf(`${doc.id}.pdf`, doc.name, [doc.detail]); }}
                        >
                          Télécharger
                        </Button>
                      )
                    }
                  />
                );
              })}
            </ul>
          );
        }}
      </Async3>
    </SectionCard>
  );
}
