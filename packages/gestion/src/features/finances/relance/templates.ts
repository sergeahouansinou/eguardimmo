import { formatDate } from '../dates';
import { joursRetard } from '../derive';
import type { Bail, Echeance, FinancesData } from '../schemas';

export const NIVEAUX = ['amiable', 'seconde', 'mise_en_demeure'] as const;
export type Niveau = (typeof NIVEAUX)[number];

export const NIVEAU_LABELS: Record<Niveau, string> = {
  amiable: 'Relance amiable',
  seconde: 'Deuxième relance',
  mise_en_demeure: 'Mise en demeure',
};

export interface RelanceContext {
  locataire: string;
  bien: string;
  libelle: string;
  echeance: string;
  derniere: string | null;
  today: string;
  delai: string;
}

export interface RelanceModele {
  id: string;
  niveau: Niveau;
  label: string;
  objet: (context: RelanceContext) => string;
  corps: (context: RelanceContext) => string;
}

const due = (context: RelanceContext) => `l’échéance « ${context.libelle} », due le ${formatDate(context.echeance)},`;
const previous = (context: RelanceContext) => (context.derniere ? ` malgré notre relance du ${formatDate(context.derniere)}` : '');

export const MODELES: readonly RelanceModele[] = [
  {
    id: 'relance-amiable',
    niveau: 'amiable',
    label: 'Relance amiable de loyer',
    objet: (context) => `${context.libelle} impayé`,
    corps: (context) =>
      `Sauf erreur de notre part, ${due(context)} n’a pas été réglée${previous(context)}.\n\nNous vous remercions de régulariser cette somme sous huit jours. Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.`,
  },
  {
    id: 'rappel-courtois',
    niveau: 'amiable',
    label: 'Rappel courtois, version courte',
    objet: (context) => `Rappel : ${context.libelle}`,
    corps: (context) =>
      `Nous n’avons pas encore reçu le règlement de ${due(context)} pour ${context.bien}.\n\nMerci de le régler dès que possible. Si vous rencontrez une difficulté, contactez-nous : nous pouvons étudier un échéancier.`,
  },
  {
    id: 'seconde-relance',
    niveau: 'seconde',
    label: 'Deuxième relance de loyer',
    objet: (context) => `Deuxième relance, ${context.libelle}`,
    corps: (context) =>
      `Malgré notre précédent courrier${context.derniere ? ` du ${formatDate(context.derniere)}` : ''}, ${due(context)} reste impayée à ce jour.\n\nNous vous demandons de régulariser cette somme sous ${context.delai}. Passé ce délai, nous serons contraints d’engager une procédure de recouvrement, dont les frais seront à votre charge.`,
  },
  {
    id: 'mise-en-demeure',
    niveau: 'mise_en_demeure',
    label: 'Mise en demeure de payer',
    objet: (context) => `Mise en demeure de payer, ${context.libelle}`,
    corps: (context) =>
      `Nous constatons que ${due(context)} demeure impayée${previous(context)}.\n\nPar la présente, nous vous mettons en demeure de régler la somme ci-dessous sous ${context.delai} à réception. À défaut, nous saisirons un commissaire de justice pour délivrer un commandement de payer, les frais restant à votre charge.`,
  },
  {
    id: 'mise-en-demeure-commandement',
    niveau: 'mise_en_demeure',
    label: 'Mise en demeure avant commandement',
    objet: (context) => `Dernier avis avant commandement de payer, ${context.libelle}`,
    corps: (context) =>
      `Malgré nos relances${context.derniere ? ` dont la dernière date du ${formatDate(context.derniere)}` : ''}, ${due(context)} n’est toujours pas réglée.\n\nCeci est un dernier avis : sans paiement sous ${context.delai}, un commandement de payer sera délivré par commissaire de justice, avec les frais afférents.`,
  },
];

export const modelesOf = (niveau: Niveau): readonly RelanceModele[] => MODELES.filter((modele) => modele.niveau === niveau);

export function modeleById(id: string): RelanceModele | undefined {
  return MODELES.find((modele) => modele.id === id);
}

export function relanceContext(data: FinancesData, echeance: Echeance, bail: Bail): RelanceContext {
  const dates = data.relances.filter((relance) => relance.echeanceId === echeance.id).map((relance) => relance.date).sort();
  return {
    locataire: bail.locataire,
    bien: `${bail.unite}, ${bail.immeuble}`,
    libelle: echeance.libelle,
    echeance: echeance.echeance,
    derniere: dates[dates.length - 1] ?? null,
    today: data.today,
    delai: 'huit jours',
  };
}

export function suggestedNiveau(data: FinancesData, echeance: Echeance): Niveau {
  const relances = data.relances.filter((relance) => relance.echeanceId === echeance.id);
  if (relances.some((relance) => relance.canal === 'recommande')) return 'mise_en_demeure';
  if (relances.length === 0) return 'amiable';
  return joursRetard(echeance, data.today) >= 15 ? 'mise_en_demeure' : 'seconde';
}

export function tenantEmail(locataire: string): string {
  const slug = locataire
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${slug}@example.com`;
}
