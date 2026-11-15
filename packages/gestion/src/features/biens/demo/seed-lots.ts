import type { ImmeubleRecord, LotRecord } from './records';

const euros = (value: number) => value * 100;

export const seedImmeubles: ImmeubleRecord[] = [
  {
    row: {
      id: 'les-tilleuls',
      name: 'Les Tilleuls',
      address: '12 rue des Lilas',
      postalCode: '75011',
      city: 'Paris',
      country: 'France',
      repartition: 'tantiemes',
      copropriete: true,
      archived: false,
    },
    tantiemesTotal: 1000,
    builtYear: 1972,
    levels: 'R+5, ascenseur',
    heating: 'Individuel',
    syndic: 'Cabinet Lemoine',
    registration: 'AB1-234-567',
    totalLots: 24,
    photoNames: [],
    photoLabels: ['Façade sur rue', 'Hall d’entrée', 'Cour intérieure'],
    photoCount: 6,
  },
  {
    row: {
      id: 'residence-du-parc',
      name: 'Résidence du Parc',
      address: '3 avenue du Parc',
      postalCode: '69006',
      city: 'Lyon',
      country: 'France',
      repartition: 'surface',
      copropriete: false,
      archived: false,
    },
    tantiemesTotal: 0,
    builtYear: 1988,
    levels: 'R+4, ascenseur',
    heating: 'Collectif',
    syndic: null,
    registration: null,
    totalLots: null,
    photoNames: [],
    photoLabels: ['Façade'],
    photoCount: 1,
  },
  {
    row: {
      id: 'maison-riviere',
      name: 'Maison Rivière',
      address: '8 chemin de la Rivière',
      postalCode: '33000',
      city: 'Bordeaux',
      country: 'France',
      repartition: 'surface',
      copropriete: false,
      archived: false,
    },
    tantiemesTotal: 0,
    builtYear: 2004,
    levels: 'R+1',
    heating: 'Individuel',
    syndic: null,
    registration: null,
    totalLots: null,
    photoNames: [],
    photoLabels: ['Façade sur jardin'],
    photoCount: 1,
  },
];

type LotSeed = Omit<LotRecord, 'street' | 'complement' | 'postalCode' | 'city' | 'photoNames' | 'rich'>;

const lotSeeds: LotSeed[] = [
  {
    row: {
      id: 'apt-a1', name: 'Apt A1', immeubleId: 'les-tilleuls', type: 'appartement', surface: 64.2, rooms: 3, floor: '2e',
      tenant: { id: 'koffi-adjovi', name: 'Koffi Adjovi' }, rent: euros(850), listing: 'hors_ligne', status: 'retard',
      tantiemes: 128, elevatorShares: 128, leaseEnd: '2029-03-31', leaseNote: null, archived: false,
    },
    elevator: true, heating: 'electrique', amenities: ['cuisine_equipee', 'balcon', 'cave', 'climatisation'], rentExcl: euros(770), charges: euros(80),
  },
  {
    row: {
      id: 'apt-a2', name: 'Apt A2', immeubleId: 'les-tilleuls', type: 'appartement', surface: 70.5, rooms: 3, floor: '3e',
      tenant: { id: 'nadege-sossou', name: 'Nadège Sossou' }, rent: euros(990), listing: 'hors_ligne', status: 'a_jour',
      tantiemes: 140, elevatorShares: 140, leaseEnd: '2027-08-31', leaseNote: null, archived: false,
    },
    elevator: true, heating: 'electrique', amenities: ['cuisine_equipee', 'balcon', 'lave_linge'], rentExcl: euros(900), charges: euros(90),
  },
  {
    row: {
      id: 'apt-b1', name: 'Apt B1', immeubleId: 'les-tilleuls', type: 'appartement', surface: 52, rooms: 2, floor: '1er',
      tenant: { id: 'clarisse-hounkpatin', name: 'Clarisse Hounkpatin' }, rent: euros(1020), listing: 'hors_ligne', status: 'retard',
      tantiemes: 104, elevatorShares: 104, leaseEnd: '2027-08-31', leaseNote: null, archived: false,
    },
    elevator: true, heating: 'electrique', amenities: ['cuisine_equipee'], rentExcl: euros(930), charges: euros(90),
  },
  {
    row: {
      id: 'studio-b3', name: 'Studio B3', immeubleId: 'les-tilleuls', type: 'studio', surface: 28, rooms: 1, floor: '5e',
      tenant: { id: 'yann-le-gall', name: 'Yann Le Gall' }, rent: euros(700), listing: 'hors_ligne', status: 'preavis',
      tantiemes: 30, elevatorShares: 30, leaseEnd: '2027-01-31', leaseNote: null, archived: false,
    },
    elevator: true, heating: 'electrique', amenities: ['cuisine_equipee'], rentExcl: euros(650), charges: euros(50),
  },
  {
    row: {
      id: 'parking-p4', name: 'Parking P4', immeubleId: 'les-tilleuls', type: 'parking', surface: 12, rooms: 0, floor: '-1',
      tenant: { id: 'awa-traore', name: 'Awa Traoré' }, rent: euros(70), listing: 'hors_ligne', status: 'a_jour',
      tantiemes: 10, elevatorShares: null, leaseEnd: null, leaseNote: 'Tacite, 1 mois', archived: false,
    },
    elevator: false, heating: 'electrique', amenities: [], rentExcl: euros(70), charges: 0,
  },
  {
    row: {
      id: 'studio-2e', name: 'Studio 2e', immeubleId: 'residence-du-parc', type: 'studio', surface: 24, rooms: 1, floor: '2e',
      tenant: { id: 'ibrahim-yao', name: 'Ibrahim Yao' }, rent: euros(780), listing: 'en_ligne', status: 'preavis',
      tantiemes: null, elevatorShares: null, leaseEnd: '2026-12-31', leaseNote: null, archived: false,
    },
    elevator: true, heating: 'electrique', amenities: ['cuisine_equipee', 'lave_linge'], rentExcl: euros(720), charges: euros(60),
  },
  {
    row: {
      id: 'apt-c2', name: 'Apt C2', immeubleId: 'residence-du-parc', type: 'appartement', surface: 41, rooms: 2, floor: 'RDC',
      tenant: null, rent: euros(540), listing: 'hors_ligne', status: 'travaux',
      tantiemes: null, elevatorShares: null, leaseEnd: null, leaseNote: null, archived: false,
    },
    elevator: false, heating: 'gaz', amenities: ['cuisine_equipee'], rentExcl: euros(490), charges: euros(50),
  },
  {
    row: {
      id: 'apt-d4', name: 'Apt D4', immeubleId: 'residence-du-parc', type: 'appartement', surface: 54, rooms: 2, floor: '4e',
      tenant: null, rent: euros(780), listing: 'en_ligne', status: 'a_louer',
      tantiemes: null, elevatorShares: null, leaseEnd: null, leaseNote: null, archived: false,
    },
    elevator: true, heating: 'gaz', amenities: ['cuisine_equipee', 'balcon', 'cave'], rentExcl: euros(710), charges: euros(70),
  },
  {
    row: {
      id: 'villa-rdc', name: 'Villa RDC', immeubleId: 'maison-riviere', type: 'maison', surface: 140, rooms: 5, floor: 'RDC',
      tenant: { id: 'marc-dossou', name: 'Marc Dossou' }, rent: euros(2050), listing: 'hors_ligne', status: 'a_jour',
      tantiemes: null, elevatorShares: null, leaseEnd: '2027-06-30', leaseNote: null, archived: false,
    },
    elevator: false, heating: 'gaz', amenities: ['cuisine_equipee', 'balcon', 'cave', 'lave_linge'], rentExcl: euros(1900), charges: euros(150),
  },
  {
    row: {
      id: 'studio-jardin', name: 'Studio jardin', immeubleId: 'maison-riviere', type: 'studio', surface: 25, rooms: 1, floor: 'RDC',
      tenant: null, rent: euros(550), listing: 'en_ligne', status: 'a_louer',
      tantiemes: null, elevatorShares: null, leaseEnd: null, leaseNote: null, archived: false,
    },
    elevator: false, heating: 'electrique', amenities: ['cuisine_equipee'], rentExcl: euros(500), charges: euros(50),
  },
  {
    row: {
      id: 'garage-g1', name: 'Garage G1', immeubleId: 'maison-riviere', type: 'garage', surface: 12, rooms: 0, floor: 'RDC',
      tenant: { id: 'marc-dossou', name: 'Marc Dossou' }, rent: euros(90), listing: 'hors_ligne', status: 'a_jour',
      tantiemes: null, elevatorShares: null, leaseEnd: null, leaseNote: 'Tacite, 1 mois', archived: false,
    },
    elevator: false, heating: 'electrique', amenities: [], rentExcl: euros(90), charges: 0,
  },
  {
    row: {
      id: 'bureau-b1', name: 'Bureau B1', immeubleId: 'les-tilleuls', type: 'bureau', surface: 30, rooms: 1, floor: '1er',
      tenant: null, rent: euros(640), listing: 'hors_ligne', status: 'a_louer',
      tantiemes: 36, elevatorShares: 36, leaseEnd: null, leaseNote: null, archived: true,
    },
    elevator: true, heating: 'electrique', amenities: [], rentExcl: euros(600), charges: euros(40),
  },
  {
    row: {
      id: 'cave-c1', name: 'Cave C1', immeubleId: 'les-tilleuls', type: 'garage', surface: 6, rooms: 0, floor: '-1',
      tenant: null, rent: euros(40), listing: 'hors_ligne', status: 'a_louer',
      tantiemes: 4, elevatorShares: null, leaseEnd: null, leaseNote: null, archived: true,
    },
    elevator: false, heating: 'electrique', amenities: [], rentExcl: euros(40), charges: 0,
  },
];

export function seedLots(): LotRecord[] {
  return lotSeeds.map((seed) => {
    const immeuble = seedImmeubles.find((item) => item.row.id === seed.row.immeubleId);
    return {
      ...seed,
      street: immeuble?.row.address ?? '',
      complement: '',
      postalCode: immeuble?.row.postalCode ?? '',
      city: immeuble?.row.city ?? '',
      photoNames: [],
      rich: null,
    };
  });
}
