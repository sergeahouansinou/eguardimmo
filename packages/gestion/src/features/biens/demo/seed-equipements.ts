import type { EquipementRow } from '../schemas/equipements';
import type { EquipementSeed } from './records';

const euros = (value: number) => value * 100;

type Op = EquipementSeed['plan'][number];
type Entry = EquipementSeed['log'][number];

function row(partial: Partial<EquipementRow> & Pick<EquipementRow, 'id' | 'name' | 'family' | 'placeName'>): EquipementRow {
  return {
    detail: '',
    lotId: null,
    immeubleId: null,
    room: null,
    brand: null,
    model: null,
    purchasedOn: null,
    price: null,
    warrantyEndsOn: null,
    warrantyNote: null,
    nextMaintenanceOn: null,
    maintenanceNote: null,
    chargedTo: 'bailleur',
    status: 'en_service',
    provider: null,
    lastVisitOn: null,
    obligation: null,
    contractYearly: null,
    archived: false,
    ...partial,
  };
}

const planOp = (
  id: string,
  label: string,
  doneBy: string,
  periodicity: string,
  lastOn: string | null,
  nextOn: string | null,
  reminder: string,
  status: Op['status'],
): Op => ({ id, label, doneBy, periodicity, lastOn, nextOn, reminder, status });

const entry = (id: string, title: string, date: string, detail: string, done: boolean, cost: number | null = null): Entry => ({
  id,
  title,
  date,
  detail,
  done,
  cost,
});

const none = { plan: [] as Op[], log: [] as Entry[] };

export const seedEquipements: EquipementSeed[] = [
  {
    row: row({
      id: 'climatiseur-reversible', name: 'Climatiseur réversible', detail: '3,5 kW', family: 'climatisation', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Séjour', brand: 'Thermea', model: 'Thermea Duo 35', purchasedOn: '2025-06-20', price: euros(1290),
      warrantyEndsOn: '2027-06-20', nextMaintenanceOn: '2027-05-20', chargedTo: 'bailleur', provider: 'Clim Services 75', lastVisitOn: '2026-05-20',
    }),
    rich: null,
    plan: [
      planOp('filtres', 'Nettoyage des filtres', 'Locataire', 'Tous les 3 mois', '2026-11-03', '2027-02-03', 'E-mail 7 jours avant', { label: 'À jour', tone: 'success' }),
      planOp('annuel', 'Entretien annuel et contrôle', 'Clim Services 75', 'Tous les 12 mois', '2026-05-20', '2027-05-20', 'Agenda, 30 jours avant', { label: 'Planifié', tone: 'info' }),
      planOp('exterieure', 'Nettoyage de l’unité extérieure', 'Clim Services 75', 'Tous les 12 mois', '2026-05-20', '2027-05-20', 'Avec l’entretien annuel', { label: 'Planifié', tone: 'info' }),
      planOp('etancheite', 'Contrôle d’étanchéité', '—', 'Non requis', null, null, '—', { label: 'Non requis', tone: 'neutral' }),
    ],
    log: [
      entry('log-1', 'Entretien annuel prévu', '2027-05-20', 'Clim Services 75', false),
      entry('log-2', 'Filtres nettoyés par le locataire', '2026-11-03', 'déclaré par Koffi Adjovi, photo jointe', true),
      entry('log-3', 'Filtres nettoyés par le locataire', '2026-08-04', 'déclaré par Koffi Adjovi', true),
      entry('log-4', 'Entretien annuel, nettoyage et contrôle', '2026-05-20', 'Clim Services 75', true, euros(95)),
      entry('log-5', 'Installation et mise en service', '2025-06-20', 'attestation de capacité fournie', true),
    ],
  },
  {
    row: row({
      id: 'ballon-d-eau-chaude-150-l', name: 'Ballon d’eau chaude 150 L', detail: '150 litres', family: 'chauffage', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Cellier', brand: 'Calora', model: 'Calora 150 vertical', purchasedOn: '2022-09-12', price: euros(920),
      warrantyEndsOn: '2027-09-12', warrantyNote: 'Cuve, jusqu’au 09/2027', nextMaintenanceOn: '2027-09-12', chargedTo: 'bailleur',
    }),
    rich: null,
    plan: [planOp('detartrage', 'Détartrage du ballon', 'Bailleur', 'Tous les 5 ans', '2022-09-12', '2027-09-12', 'Agenda, 30 jours avant', { label: 'Planifié', tone: 'info' })],
    log: [],
  },
  {
    row: row({
      id: 'plaque-induction', name: 'Plaque induction', detail: '3 feux', family: 'cuisine', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Cuisine', brand: 'Novacuisine', model: 'Novacuisine IH3', purchasedOn: '2019-05-04', price: euros(620),
      warrantyEndsOn: '2021-05-04', chargedTo: 'locataire',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'hotte-aspirante', name: 'Hotte aspirante', detail: '60 cm', family: 'cuisine', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Cuisine', brand: 'Novacuisine', model: 'Novacuisine H60', purchasedOn: '2019-05-04', price: euros(280),
      warrantyEndsOn: '2021-05-04', maintenanceNote: 'Filtres, tous les 3 mois', chargedTo: 'locataire',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'vmc-simple-flux', name: 'VMC simple flux', detail: 'Hygroréglable', family: 'ventilation', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Salle d’eau', brand: 'Aérys', model: 'Aérys S1', purchasedOn: '2016-07-20', price: euros(690),
      warrantyEndsOn: '2018-07-20', maintenanceNote: 'Bouches, tous les 6 mois', chargedTo: 'locataire',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'detecteur-de-fumee', name: 'Détecteur de fumée', detail: 'NF EN 14604', family: 'securite', lotId: 'apt-a1', immeubleId: 'les-tilleuls',
      placeName: 'Apt A1', room: 'Entrée', brand: null, model: 'Norme NF EN 14604', purchasedOn: '2023-04-01', price: euros(40),
      warrantyEndsOn: '2028-04-30', warrantyNote: 'Jusqu’au 04/2028', maintenanceNote: 'Pile, 03/2027', chargedTo: 'locataire',
    }),
    rich: null,
    plan: [planOp('pile', 'Pile du détecteur de fumée', 'Locataire', 'Tous les 12 mois', '2026-03-01', '2027-03-01', 'E-mail 7 jours avant', { label: 'Planifié', tone: 'info' })],
    log: [],
  },
  {
    row: row({
      id: 'lave-linge', name: 'Lave-linge', detail: '8 kg', family: 'electromenager', lotId: 'studio-2e', immeubleId: 'residence-du-parc',
      placeName: 'Studio 2e', room: 'Salle d’eau', purchasedOn: '2024-09-05', price: euros(429), warrantyEndsOn: '2027-09-05', chargedTo: 'bailleur',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'lave-vaisselle', name: 'Lave-vaisselle', detail: '12 couverts', family: 'electromenager', lotId: 'apt-a2', immeubleId: 'les-tilleuls',
      placeName: 'Apt A2', room: 'Cuisine', purchasedOn: '2024-01-14', price: euros(389), warrantyEndsOn: '2026-01-14', chargedTo: 'bailleur',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'plaques-induction', name: 'Plaques induction', detail: '3 feux', family: 'cuisine', lotId: 'apt-d4', immeubleId: 'residence-du-parc',
      placeName: 'Apt D4', room: 'Cuisine', purchasedOn: '2026-02-02', price: euros(349), warrantyEndsOn: '2028-02-02', chargedTo: 'bailleur',
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'chauffe-eau', name: 'Chauffe-eau', detail: '200 litres', family: 'chauffage', lotId: 'villa-rdc', immeubleId: 'maison-riviere',
      placeName: 'Villa RDC', room: 'Buanderie', purchasedOn: '2019-03-12', price: euros(640), warrantyEndsOn: '2021-03-12', nextMaintenanceOn: '2026-11-30',
      chargedTo: 'bailleur', status: 'hors_service',
    }),
    rich: null,
    plan: [],
    log: [entry('panne', 'Panne signalée par le locataire', '2026-11-05', 'plus d’eau chaude, intervention ouverte', true)],
  },
  {
    row: row({
      id: 'ascenseur-630-kg', name: 'Ascenseur, 630 kg', detail: '630 kg', family: 'acces', immeubleId: 'les-tilleuls', placeName: 'Les Tilleuls (parties communes)',
      chargedTo: 'copropriete', provider: 'Ascenseurs Delta', lastVisitOn: '2026-10-28', nextMaintenanceOn: '2026-12-09', obligation: 'Visite toutes les 6 semaines', contractYearly: euros(1620),
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'extincteurs-du-hall-et-du-parking', name: 'Extincteurs du hall et du parking', detail: '', family: 'securite', immeubleId: 'les-tilleuls', placeName: 'Les Tilleuls (parties communes)',
      chargedTo: 'copropriete', provider: 'Protec Feu', lastVisitOn: '2025-12-15', nextMaintenanceOn: '2026-12-15', obligation: 'Vérification annuelle', contractYearly: euros(280),
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'videophone-et-digicode', name: 'Vidéophone et digicode', detail: '', family: 'acces', immeubleId: 'les-tilleuls', placeName: 'Les Tilleuls (parties communes)',
      chargedTo: 'copropriete', provider: 'Accès Pro', lastVisitOn: '2026-04-02', nextMaintenanceOn: '2027-04-02', obligation: 'Contrat d’entretien', contractYearly: euros(380),
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'porte-automatique-du-parking', name: 'Porte automatique du parking', detail: '', family: 'acces', immeubleId: 'les-tilleuls', placeName: 'Les Tilleuls (parties communes)',
      chargedTo: 'copropriete', provider: 'Portes Moreau', lastVisitOn: '2026-05-10', nextMaintenanceOn: '2026-11-10', obligation: 'Entretien semestriel', contractYearly: euros(660),
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'ancienne-chaudiere', name: 'Ancienne chaudière', detail: 'Gaz, 24 kW', family: 'chauffage', lotId: 'studio-c2', immeubleId: 'residence-du-parc',
      placeName: 'Studio C2', room: 'Cuisine', purchasedOn: '2006-10-03', price: euros(2100), warrantyEndsOn: '2016-10-03', chargedTo: 'bailleur', archived: true,
    }),
    rich: null,
    ...none,
  },
  {
    row: row({
      id: 'convecteur-bureau', name: 'Convecteur', detail: '1500 W', family: 'chauffage', lotId: 'bureau-b1', immeubleId: 'les-tilleuls',
      placeName: 'Bureau B1', room: 'Bureau', purchasedOn: '2021-01-12', price: euros(120), warrantyEndsOn: '2023-01-12', chargedTo: 'bailleur', archived: true,
    }),
    rich: null,
    ...none,
  },
];
