import type { EquipementRecord } from './records';

const euros = (value: number) => value * 100;
const ok = (label: string, value: string) => ({ label, value });

export const climatiseurRich: NonNullable<EquipementRecord['rich']> = {
  subtitle: 'Apt A1, Les Tilleuls · Séjour · Famille climatisation',
  badges: [
    { label: 'Bon état', tone: 'success' },
    { label: 'Sous garantie', tone: 'info' },
  ],
  photoCount: 3,
  photos: [{ id: 'unite-interieure', label: 'Unité intérieure', cover: true }],
  identification: [
    ok('Marque', 'Thermea'),
    ok('Modèle', 'Duo 35 Inverter'),
    ok('Numéro de série', 'TH35-2506-08841'),
    ok('Puissance', '3,5 kW froid, 4,0 kW chaud'),
    ok('Classe énergie', 'A++ froid, A+ chaud'),
    ok('Durée de vie', '15 ans, jusqu’en 2040'),
    ok('Fluide', 'R32, 0,80 kg'),
    ok('Unité extérieure', 'Balcon, support mural'),
    ok('Installateur', 'Clim Services 75'),
    ok('Mise en service', '20/06/2025'),
    ok('Prix d’achat', '1 290 €, posé'),
    ok('État', 'Bon, vérifié le 20/05/2026'),
  ],
  warranty: { coverage: 'Pièces et main-d’œuvre', months: 24, startsOn: '2025-06-20', endsOn: '2027-06-20' },
  maintenanceRows: [
    ok('Prochain entretien', '20/05/2027'),
    ok('Périodicité', 'Tous les 12 mois'),
    ok('Filtres, entretien courant', 'Locataire'),
    ok('Contrôle d’étanchéité', 'Non obligatoire'),
  ],
  cost: { total: euros(1385), maintenance: euros(95), lifetimeYears: 15, replacementYear: 2040 },
  warrantyDocs: [
    ok('Pièces et main-d’œuvre', 'Jusqu’au 20/06/2027'),
    ok('Compresseur', 'Jusqu’au 20/06/2030'),
    ok('Condition', 'Entretien annuel'),
    ok('Facture conservée', 'Oui'),
  ],
  reasons: [
    { id: 'filtres', title: 'Filtres', detail: 'Entretien courant, à la charge du locataire' },
    { id: 'annuel', title: 'Entretien annuel', detail: 'Exigé par le fabricant pour la garantie' },
    { id: 'etancheite', title: 'Étanchéité', detail: 'Requise dès 5 t éq. CO₂, ici 0,54 t' },
  ],
};
