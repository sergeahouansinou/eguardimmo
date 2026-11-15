'use client';

import { useLeaseLookups } from './BauxParts';
import { useReservations } from './hooks';
import { bauxPaths } from './paths';
import type { Reservation } from './schemas';
import { BAILLEUR, DocumentViewer, Paper, PaperHeader } from '../courriers/DocumentViewer';
import { RecordGate } from '../courriers/RecordGate';
import { LedgerLines, LinkButton, PageHeader } from '../locataires/kit';
import { daysBetween, formatDateFr, longDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'Réservations', href: bauxPaths.reservations }];

export function ReservationContratPage({ id }: { id: string }) {
  const reservations = useReservations();
  return (
    <RecordGate
      query={reservations}
      find={(item) => item.id === id}
      crumbs={crumbs}
      title="Contrat de location"
      missing={{ title: 'Réservation introuvable', description: 'Elle n’existe pas ou le lien est incorrect.', backHref: bauxPaths.reservations, backLabel: 'Retour aux réservations' }}
    >
      {(item) => <ContractSheet item={item} />}
    </RecordGate>
  );
}

function ContractSheet({ item }: { item: Reservation }) {
  const lookups = useLeaseLookups();
  const nights = daysBetween(item.arrival, item.departure);
  const unit = lookups.unitLabel(item.unitId);
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: item.reference }, { label: 'Contrat' }]}
        title={`Contrat de location ${item.reference}`}
        subtitle={`${item.guest}, ${unit}`}
        actions={<LinkButton href={bauxPaths.reservations}>Retour aux réservations</LinkButton>}
      />
      <DocumentViewer title={`Contrat ${item.reference}`}>
        <Paper label={`Contrat de location saisonnière ${item.reference}`}>
          <PaperHeader right={<><b className="text-block-title">Contrat de location saisonnière</b><span className="text-body text-fg-muted">{`Réf. ${item.reference}`}</span></>} />
          <p className="text-body">{`Entre ${BAILLEUR.name}, bailleur, et ${item.guest}, locataire, il est convenu la location meublée de courte durée suivante.`}</p>
          <LedgerLines
            lines={[
              { label: 'Bien loué', value: unit },
              { label: 'Arrivée', value: formatDateFr(item.arrival) },
              { label: 'Départ', value: formatDateFr(item.departure) },
              { label: 'Durée', value: `${String(nights)} nuit${nights > 1 ? 's' : ''}` },
              { label: 'Dépôt de garantie', value: money(item.deposit) },
              { label: 'Acompte reçu', value: money(item.paid) },
            ]}
            total={{ label: 'Montant du séjour', value: money(item.amount) }}
          />
          <p className="text-caption text-fg-subtle">Le solde est exigible à l’arrivée. Le dépôt de garantie est restitué sous un mois après l’état des lieux de sortie, déduction faite des éventuelles dégradations.</p>
          <div className="mt-auto grid grid-cols-2 gap-6 pt-6">
            <div className="flex flex-col gap-8"><span className="text-body-strong">Le bailleur</span><span aria-hidden="true" className="h-px bg-line-strong" /></div>
            <div className="flex flex-col gap-8"><span className="text-body-strong">Le locataire</span><span aria-hidden="true" className="h-px bg-line-strong" /></div>
          </div>
          <footer className="flex justify-between border-t border-line pt-3 text-caption text-fg-subtle">
            <span>{`Établi le ${longDateFr(todayIso())}`}</span>
            <span>{BAILLEUR.name}</span>
          </footer>
        </Paper>
      </DocumentViewer>
    </>
  );
}
