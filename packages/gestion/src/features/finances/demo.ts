import { slugify } from './derive';
import { demoLeases } from '../baux/demo';
import { demoTenants, demoUnits } from '../locataires/demo';
import type { Bail, Depense, Echeance, Facture, FinancesData, LigneBancaire, Paiement, Relance } from './schemas';

const euros = (value: number) => Math.round(value * 100);
export const DEMO_TODAY = '2026-11-13';
export const DEMO_NOW = '2026-11-13T10:02:00+01:00';

const PROPRIETAIRES: Readonly<Record<string, string>> = { 'Maison Rivière': 'SCI Rivière' };
const PROPRIETAIRE_PAR_DEFAUT = 'Awa Diallo';
const NOVEMBRE = '2026-11-01';
const DECEMBRE = '2026-12-01';

const BAUX_SUIVIS = ['apt-a1', 'apt-b1', 'studio-2e', 'villa-rdc', 'apt-a2', 'studio-b3', 'apt-a3', 'apt-b2', 'studio-c2'] as const;
const ENCAISSE_NOVEMBRE: Readonly<Record<string, number>> = { 'apt-a1': 0, 'apt-b1': euros(810), 'studio-2e': euros(720), 'villa-rdc': euros(2100) };

const nomLocataire = (tenantId: string): string => {
  const tenant = demoTenants.find((item) => item.id === tenantId);
  if (!tenant) throw new Error(`Locataire de démonstration absent : ${tenantId}`);
  return `${tenant.firstName} ${tenant.lastName}`;
};

const bauxCanoniques = BAUX_SUIVIS.map((unitId) => {
  const lease = demoLeases.find((item) => item.unitId === unitId && (item.status === 'en_cours' || item.status === 'preavis'));
  const unit = demoUnits.find((item) => item.id === unitId);
  const tenantId = lease?.tenantIds[0];
  if (!lease || !unit || !tenantId) throw new Error(`Bail de démonstration absent : ${unitId}`);
  return { lease, unit, tenantId, locataire: nomLocataire(tenantId), appele: lease.rent + lease.charges };
});

const baux: Bail[] = bauxCanoniques.map(({ lease, unit, tenantId, locataire }) => ({
  id: slugify(lease.reference),
  numero: lease.reference,
  locataireId: tenantId,
  locataire,
  unite: unit.label,
  immeuble: unit.building,
  proprietaire: PROPRIETAIRES[unit.building] ?? PROPRIETAIRE_PAR_DEFAUT,
}));

const echeance = (locataire: string, bailNumero: string, libelle: string, date: string, montant: number, paye: number): Echeance => ({
  id: `ech-${date.slice(0, 7)}-${slugify(locataire)}`,
  bailId: slugify(bailNumero),
  libelle,
  echeance: date,
  montant,
  paye,
  statut: 'active',
  justificatifs: [],
});

const echeances: Echeance[] = [
  ...bauxCanoniques.map(({ lease, unit, locataire, appele }) => echeance(locataire, lease.reference, 'Loyer novembre 2026', NOVEMBRE, appele, ENCAISSE_NOVEMBRE[unit.id] ?? appele)),
  ...bauxCanoniques
    .filter(({ unit }) => unit.id === 'villa-rdc')
    .map(({ lease, locataire, appele }) => echeance(locataire, lease.reference, 'Loyer décembre 2026', DECEMBRE, appele, 0)),
];

const payment = (id: string, locataire: string, bailNumero: string, date: string, montant: number, mode: Paiement['mode'], extra: Partial<Paiement> = {}): Paiement => ({
  id,
  bailId: slugify(bailNumero),
  echeanceId: echeances.find((item) => item.bailId === slugify(bailNumero) && item.echeance.startsWith('2026-11'))?.id ?? null,
  date,
  montant,
  mode,
  nature: 'echeance',
  reference: '',
  note: '',
  comptabilise: true,
  mentionQuittance: true,
  recuId: null,
  libelle: `Loyer novembre 2026, ${locataire}`,
  ...extra,
});

const numeroDe = (unitId: string): string => {
  const found = bauxCanoniques.find(({ unit }) => unit.id === unitId);
  if (!found) throw new Error(`Bail de démonstration absent : ${unitId}`);
  return found.lease.reference;
};
const appeleDe = (unitId: string): number => bauxCanoniques.find(({ unit }) => unit.id === unitId)?.appele ?? 0;

const paiements: Paiement[] = [
  payment('pay-nadege-sossou', 'Nadège Sossou', numeroDe('apt-a2'), '2026-11-12', appeleDe('apt-a2'), 'virement'),
  payment('pay-ibrahim-yao', 'Ibrahim Yao', numeroDe('studio-2e'), '2026-11-12', euros(720), 'virement', {
    nature: 'acompte_loyer',
    reference: 'VIR-IY-1112',
    note: 'Virement reçu le 12/11, solde annoncé pour le 20/11.',
    recuId: 'rc-2026-0187',
  }),
  payment('pay-marc-dossou', 'Marc Dossou', numeroDe('villa-rdc'), '2026-11-10', euros(2100), 'virement'),
  payment('pay-clarisse-hounkpatin', 'Clarisse Hounkpatin', numeroDe('apt-b1'), '2026-11-05', euros(810), 'prelevement'),
  payment('pay-fatou-bamba', 'Fatou Bamba', numeroDe('apt-b2'), '2026-11-04', appeleDe('apt-b2'), 'virement'),
  payment('pay-yann-le-gall', 'Yann Le Gall', numeroDe('studio-b3'), '2026-11-03', appeleDe('studio-b3'), 'virement'),
  payment('pay-awa-traore', 'Awa Traoré', numeroDe('apt-a3'), '2026-11-03', appeleDe('apt-a3'), 'prelevement'),
  payment('pay-moussa-diallo', 'Moussa Diallo', numeroDe('studio-c2'), '2026-11-02', appeleDe('studio-c2'), 'virement'),
];

const depense = (id: string, bien: string, type: Depense['type'], date: string, montant: number, fournisseur: string, description: string, numeroFacture: string): Depense => ({
  id,
  bien,
  type,
  date,
  montantTtc: euros(montant),
  fournisseur,
  description,
  numeroFacture,
  deductible: true,
  recuperable: false,
  nonComptabilise: false,
  justificatif: null,
  annulee: false,
});

const depenses: Depense[] = [
  depense('dep-entretien-chaudiere', 'Studio 2e, Résidence du Parc', 'entretien', '2026-11-06', 200, 'Chaudières Services', 'Entretien annuel de la chaudière.', 'CS-20261106'),
  depense('dep-ampoules', 'Apt B3, Les Tilleuls', 'reparation', '2026-11-06', 30, 'Quincaillerie du Port', 'Ampoules des parties communes remplacées.', 'QUI-20261106'),
  depense('dep-joint-robinet', 'Villa RDC, Maison Rivière', 'reparation', '2026-11-04', 55, 'Plomberie Agbodjo', 'Joint de robinet remplacé.', 'PLB-20261104'),
];

const relance = (id: string, echeanceId: string, date: string, canal: Relance['canal'], amiable: boolean): Relance => ({ id, echeanceId, date, canal, amiable });

const relances: Relance[] = [
  relance('rel-1', 'ech-2026-11-koffi-adjovi', '2026-11-02', 'courrier', true),
  relance('rel-2', 'ech-2026-11-koffi-adjovi', '2026-11-08', 'email', true),
  relance('rel-3', 'ech-2026-11-koffi-adjovi', '2026-11-10', 'recommande', false),
  relance('rel-4', 'ech-2026-11-ibrahim-yao', '2026-11-11', 'email', true),
];

const OBJETS: [string, number][] = [
  ['Frais de relance', 15],
  ['Remise en état, serrure', 96],
  ['Frais d’état des lieux', 45],
  ['Régularisation des charges', 212],
  ['Frais de quittancement', 8],
  ['Réparation locative', 64],
];
const DESTINATAIRES = ['Koffi Adjovi', 'Clarisse Hounkpatin', 'Ibrahim Yao', 'Marc Dossou', 'Nadège Sossou', 'Yann Le Gall'];

function facture(n: number, fields: Partial<Facture> & Pick<Facture, 'date' | 'destinataire' | 'objet' | 'montantTtc'>): Facture {
  const numero = `FA-2026-${String(n).padStart(4, '0')}`;
  const montant = fields.montantTtc;
  return {
    id: slugify(numero),
    numero,
    type: 'facture',
    locataireId: slugify(fields.destinataire),
    montantHt: montant,
    tvaPct: 0,
    echeance: null,
    statut: 'payee',
    payeLe: fields.date,
    envoyeLe: fields.date,
    lignes: [{ designation: fields.objet, reference: '', quantite: 1, prixUnitaire: montant, montant }],
    bailId: baux.find((entry) => entry.locataire === fields.destinataire)?.id ?? null,
    dossierId: null,
    factureOrigineId: null,
    avoirId: null,
    empreinte: '',
    scelleLe: `${fields.date}T10:00:00+01:00`,
    ...fields,
  };
}

const history: Facture[] = Array.from({ length: 21 }, (_, index) => {
  const n = 21 - index;
  const [objet, montant] = OBJETS[n % OBJETS.length] ?? OBJETS[0] ?? ['Frais', 10];
  const date = `2026-${String(1 + Math.floor((n - 1) / 3)).padStart(2, '0')}-${String(5 + ((n * 7) % 20)).padStart(2, '0')}`;
  return facture(n, { date, destinataire: DESTINATAIRES[n % DESTINATAIRES.length] ?? 'Koffi Adjovi', objet, montantTtc: euros(montant) });
});

function avoir(n: number, date: string, origine: Facture): Facture {
  const numero = `AV-2026-${String(n).padStart(4, '0')}`;
  return {
    ...origine,
    id: slugify(numero),
    numero,
    type: 'avoir',
    date,
    objet: `Avoir sur ${origine.numero}`,
    montantHt: -origine.montantHt,
    montantTtc: -origine.montantTtc,
    lignes: origine.lignes.map((ligne) => ({ ...ligne, prixUnitaire: -ligne.prixUnitaire, montant: -ligne.montant })),
    echeance: null,
    statut: 'avoir',
    payeLe: null,
    envoyeLe: date,
    factureOrigineId: origine.id,
    avoirId: null,
    scelleLe: `${date}T10:00:00+01:00`,
  };
}

function seedInvoices(): Facture[] {
  const byNumber = (n: number): Facture => {
    const found = history.find((item) => item.numero === `FA-2026-${String(n).padStart(4, '0')}`);
    if (!found) throw new Error(`Facture de démonstration FA-2026-${String(n)} absente.`);
    return found;
  };
  const fa7 = byNumber(7);
  const fa19: Facture = { ...byNumber(19), destinataire: 'Nadège Sossou', locataireId: 'nadege-sossou', bailId: 'bl-2024-0011', objet: 'Frais d’état des lieux', montantHt: euros(100), montantTtc: euros(100), statut: 'attente', payeLe: null, avoirId: 'av-2026-0002' };
  fa19.lignes = [{ designation: fa19.objet, reference: '', quantite: 1, prixUnitaire: euros(100), montant: euros(100) }];
  const av1 = avoir(1, '2026-03-30', fa7);
  fa7.avoirId = av1.id;
  const av2 = avoir(2, '2026-11-05', { ...fa19, montantHt: euros(40), montantTtc: euros(40), lignes: [{ designation: fa19.objet, reference: '', quantite: 1, prixUnitaire: euros(40), montant: euros(40) }] });
  const olderHistory = history.map((item) => (item.numero === fa19.numero ? fa19 : item));
  const fa22 = facture(22, { date: '2026-10-28', destinataire: 'Ibrahim Yao', objet: 'Remise en état, serrure', montantTtc: euros(96), statut: 'attente', payeLe: null, echeance: '2026-11-27', envoyeLe: '2026-10-28' });
  const fa23 = facture(23, {
    date: '2026-11-02',
    destinataire: 'Koffi Adjovi',
    objet: 'Frais de relance',
    montantTtc: euros(15),
    payeLe: '2026-11-04',
    echeance: '2026-11-17',
    dossierId: 'dos-rc-2026-0011',
    lignes: [{ designation: 'Relance amiable par courrier, Gestion Les Tilleuls', reference: 'Acte n° 1', quantite: 1, prixUnitaire: euros(15), montant: euros(15) }],
  });
  const fa24 = facture(24, { date: '2026-11-10', destinataire: 'Marc Dossou', objet: 'Régularisation des charges', montantTtc: euros(212), statut: 'attente', payeLe: null, echeance: '2026-12-10', envoyeLe: null });
  const fa25 = facture(25, {
    date: '2026-11-13',
    destinataire: 'Koffi Adjovi',
    objet: 'Frais de recouvrement',
    montantTtc: 13070,
    statut: 'attente',
    payeLe: null,
    echeance: '2026-11-28',
    envoyeLe: null,
    dossierId: 'dos-rc-2026-0011',
    scelleLe: '2026-11-13T10:41:00+01:00',
    lignes: [
      { designation: 'Mise en demeure, lettre recommandée AR', reference: 'Acte n° 3', quantite: 1, prixUnitaire: 620, montant: 620 },
      { designation: 'Commandement de payer, commissaire de justice', reference: 'Acte n° 4', quantite: 1, prixUnitaire: 12450, montant: 12450 },
    ],
  });
  return [fa25, fa24, av2, fa23, fa22, ...olderHistory.slice().sort((a, b) => b.numero.localeCompare(a.numero)), av1];
}

const ligne = (id: string, date: string, libelle: string, montant: number, statut: LigneBancaire['statut'], echeanceProposeeId: string | null, indication: string): LigneBancaire => ({
  id,
  date,
  libelle,
  compte: 'Compte principal',
  montant: euros(montant),
  statut,
  echeanceProposeeId,
  indication,
  cle: `${date}|${libelle}|${String(euros(montant))}`,
});

const lignesBancaires: LigneBancaire[] = [
  ligne('bnk-koffi', '2026-11-12', 'VIR KOFFI ADJOVI NOV', 850, 'a_rapprocher', 'ech-2026-11-koffi-adjovi', 'Loyer de novembre, Apt A1'),
  ligne('bnk-sossou', '2026-11-11', 'VIR SOSSOU NADEGE', 900, 'a_rapprocher', 'ech-2026-11-nadege-sossou', 'Loyer d’octobre déjà réglé, à vérifier'),
  ligne('bnk-edf', '2026-11-10', 'PRLV EDF', -96, 'a_rapprocher', null, 'Aucune, dépense à classer'),
  ligne('bnk-quincaillerie', '2026-11-09', 'CB QUINCAILLERIE', -42, 'a_rapprocher', null, 'Aucune, dépense à classer'),
  ligne('bnk-marc', '2026-11-10', 'VIR DOSSOU MARC', 2100, 'rapprochee', 'ech-2026-11-marc-dossou', 'Rapprochée avec Loyer novembre 2026, Villa RDC'),
  ligne('bnk-clarisse', '2026-11-05', 'PRLV CLARISSE HOUNKPATIN', 810, 'rapprochee', 'ech-2026-11-clarisse-hounkpatin', 'Rapprochée avec Loyer novembre 2026, Apt B1'),
  ligne('bnk-frais', '2026-11-03', 'FRAIS TENUE DE COMPTE', -12, 'archivee', null, 'Ignorée'),
];

export function createDemoFinances(): FinancesData {
  return {
    today: DEMO_TODAY,
    currency: 'EUR',
    workspace: { nom: 'Gestion Les Tilleuls', adresse: '12 rue des Lilas, 75011 Paris', compte: 'Compte principal' },
    baux: structuredClone(baux),
    fournisseurs: ['Chaudières Services', 'Plomberie Agbodjo', 'Quincaillerie du Port', 'EDF', 'Assurances Rivière'],
    echeances: structuredClone(echeances),
    paiements: structuredClone(paiements),
    depenses: structuredClone(depenses),
    relances: structuredClone(relances),
    factures: seedInvoices(),
    recus: [
      {
        id: 'rc-2026-0187',
        numero: 'RC-2026-0187',
        date: '2026-11-12',
        paiementId: 'pay-ibrahim-yao',
        bailId: 'bl-2025-0002',
        echeanceId: 'ech-2026-11-ibrahim-yao',
        nature: 'acompte_loyer',
        montant: euros(720),
        mode: 'virement',
        reference: 'VIR-IY-1112',
        appele: euros(780),
        recuSurEcheance: euros(720),
        resteDu: euros(60),
        envoyeLe: '2026-11-12',
        empreinte: '',
        scelleLe: '2026-11-12T16:02:00+01:00',
      },
    ],
    dossiers: [
      {
        id: 'dos-rc-2026-0011',
        numero: 'RC-2026-0011',
        echeanceId: 'ech-2026-11-koffi-adjovi',
        ouvertLe: '2026-11-02',
        delaiJusquau: '2026-11-21',
        plan: null,
        actes: [
          { id: 'acte-1', date: '2026-11-02', kind: 'relance', libelle: 'Relance amiable par courrier', intervenant: 'Gestion Les Tilleuls', cout: 1500, factureId: 'fa-2026-0023' },
          { id: 'acte-2', date: '2026-11-08', kind: 'relance', libelle: 'Relance par e-mail, grand livre joint', intervenant: 'Gestion Les Tilleuls', cout: 0, factureId: null },
          { id: 'acte-3', date: '2026-11-10', kind: 'mise_en_demeure', libelle: 'Mise en demeure, recommandé AR', intervenant: 'La Poste', cout: 620, factureId: 'fa-2026-0025' },
          { id: 'acte-4', date: '2026-11-12', kind: 'commandement', libelle: 'Commandement de payer', intervenant: 'SCP Agbodjo, commissaire de justice', cout: 12450, factureId: 'fa-2026-0025' },
        ],
      },
    ],
    regularisations: [],
    bilans: [
      {
        annee: 2026,
        amortissementsLmnp: euros(4800),
        lignes: [
          { id: 'loyers', categorie: 'Loyers encaissés', detail: '11 mois, 9 baux actifs', sens: 'recette', montant: euros(89470), justificatifs: 'complet', manquants: 0 },
          { id: 'travaux', categorie: 'Travaux', detail: 'Plomberie, peinture, serrurerie', sens: 'charge', montant: euros(1900), justificatifs: 'manquants', manquants: 3 },
          { id: 'taxes', categorie: 'Taxes foncières', detail: 'Villa RDC, Apt A1', sens: 'charge', montant: euros(1350), justificatifs: 'complet', manquants: 0 },
          { id: 'assurance', categorie: 'Assurance', detail: 'Multirisque, 3 immeubles', sens: 'charge', montant: euros(965), justificatifs: 'complet', manquants: 0 },
        ],
      },
      {
        annee: 2025,
        amortissementsLmnp: euros(4800),
        lignes: [
          { id: 'loyers', categorie: 'Loyers encaissés', detail: '12 mois, 9 baux dont 3 en cours d’année', sens: 'recette', montant: euros(85840), justificatifs: 'complet', manquants: 0 },
          { id: 'travaux', categorie: 'Travaux', detail: 'Peinture, électricité', sens: 'charge', montant: euros(2400), justificatifs: 'complet', manquants: 0 },
          { id: 'taxes', categorie: 'Taxes foncières', detail: 'Villa RDC, Apt A1', sens: 'charge', montant: euros(1350), justificatifs: 'complet', manquants: 0 },
          { id: 'assurance', categorie: 'Assurance', detail: 'Multirisque, 3 immeubles', sens: 'charge', montant: euros(940), justificatifs: 'complet', manquants: 0 },
        ],
      },
    ],
    prets: [
      { id: 'pret-les-tilleuls', bien: 'Les Tilleuls', banque: 'Crédit du Littoral', emprunte: euros(180000), tauxBp: 145, fin: '2041-06', mensualite: euros(1012), restantDu: euros(132880), interetsAnnee: euros(2918), statut: 'en_cours', supprime: false, echeancier: null },
      { id: 'pret-residence-du-parc', bien: 'Résidence du Parc', banque: 'Caisse Rhône Alpes', emprunte: euros(95000), tauxBp: 210, fin: '2035-08', mensualite: euros(630), restantDu: euros(81500), interetsAnnee: euros(2000), statut: 'en_cours', supprime: false, echeancier: null },
      { id: 'pret-studio-c2', bien: 'Studio C2', banque: 'Banque Populaire', emprunte: euros(60000), tauxBp: 300, fin: '2025-03', mensualite: 0, restantDu: 0, interetsAnnee: 0, statut: 'rembourse', supprime: false, echeancier: null },
    ],
    lignesBancaires,
    automatisations: [
      { id: 'auto-noms', libelle: 'Proposer le rapprochement des virements dont le libellé contient le nom du locataire', active: true },
      { id: 'auto-edf', libelle: 'Classer les prélèvements EDF en dépense « Énergie »', active: true },
      { id: 'auto-frais', libelle: 'Ignorer les frais de tenue de compte', active: false },
    ],
    resume: { previsionnel12Mois: euros(16900), declaration: { annee: 2026, statut: 'brouillon' } },
    sequences: { FA: 25, AV: 2, RC: 187, DOS: 11 },
  };
}
