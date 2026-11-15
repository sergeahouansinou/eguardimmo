import { createCollection, DEMO_TODAY, euros, nextId } from '../../outils/kit';
import { formatMoney } from '../../../format/money';
import { uniqueSlug } from '../shared/ids';
import { interventionInputSchema, quoteInputSchema, statusLabels } from './schemas';
import type { HistoryEntry, Intervention } from './schemas';
import type { InterventionsSource } from './source';

const entry = (id: string, date: string, label: string, detail = ''): HistoryEntry => ({ id, date, label, detail });

export const demoInterventions: readonly Intervention[] = [
  {
    id: 'fuite-sous-evier',
    subject: 'Fuite sous évier',
    bienId: 'apt-a1',
    priority: 'urgente',
    status: 'en_cours',
    intervenant: 'Plomberie Sanvi',
    dueDate: '2026-11-16',
    updatedAt: '2026-11-13',
    description: 'Fuite sous le lavabo de la cuisine, la cuvette est humide.',
    notifyTenant: true,
    photos: [],
    archived: false,
    quote: { amount: euros(180), receivedOn: '2026-11-12', status: 'accepte' },
    history: [entry('fuite-1', '2026-11-12', 'Intervention créée', 'Priorité urgente'), entry('fuite-2', '2026-11-12', 'Intervenant assigné', 'Plomberie Sanvi'), entry('fuite-3', '2026-11-12', 'Locataire prévenu', 'Koffi Adjovi'), entry('fuite-4', '2026-11-13', 'État modifié', 'En cours')],
  },
  {
    id: 'chauffe-eau-a-remplacer',
    subject: 'Chauffe-eau à remplacer',
    bienId: 'villa-rdc',
    priority: 'normale',
    status: 'ouverte',
    intervenant: null,
    dueDate: '2026-11-30',
    updatedAt: '2026-11-10',
    description: 'Le chauffe-eau de 2009 ne tient plus la température.',
    notifyTenant: true,
    photos: [],
    archived: false,
    quote: null,
    history: [entry('chauffe-1', '2026-11-10', 'Intervention créée', 'Priorité normale')],
  },
  {
    id: 'peinture-cage-d-escalier',
    subject: "Peinture cage d'escalier",
    bienId: 'residence-du-parc',
    priority: 'basse',
    status: 'en_cours',
    intervenant: 'Peinture Dupont',
    dueDate: '2026-12-05',
    updatedAt: '2026-11-09',
    description: 'Deux couches, couleur validée avec le syndic.',
    notifyTenant: false,
    photos: [],
    archived: false,
    quote: { amount: euros(950), receivedOn: '2026-11-08', status: 'a_valider' },
    history: [entry('peinture-1', '2026-11-05', 'Intervention créée', 'Priorité basse'), entry('peinture-2', '2026-11-08', 'Devis reçu', '950 €'), entry('peinture-3', '2026-11-09', 'État modifié', 'En cours')],
  },
  {
    id: 'remplacement-de-la-serrure',
    subject: 'Remplacement de la serrure',
    bienId: 'apt-b3',
    priority: 'normale',
    status: 'terminee',
    intervenant: 'Plomberie Sanvi',
    dueDate: '2026-10-08',
    updatedAt: '2026-10-09',
    description: 'Serrure de la porte d’entrée bloquée.',
    notifyTenant: true,
    photos: [],
    archived: true,
    quote: { amount: euros(120), receivedOn: '2026-10-05', status: 'accepte' },
    history: [entry('serrure-1', '2026-10-04', 'Intervention créée', 'Priorité normale'), entry('serrure-2', '2026-10-09', 'État modifié', 'Terminée')],
  },
  {
    id: 'detartrage-de-la-chaudiere',
    subject: 'Détartrage de la chaudière',
    bienId: 'villa-rdc',
    priority: 'basse',
    status: 'terminee',
    intervenant: 'Chauffage Mensah',
    dueDate: '2026-09-22',
    updatedAt: '2026-09-22',
    description: 'Entretien annuel.',
    notifyTenant: false,
    photos: [],
    archived: true,
    quote: null,
    history: [entry('chaudiere-1', '2026-09-15', 'Intervention créée', 'Priorité basse'), entry('chaudiere-2', '2026-09-22', 'État modifié', 'Terminée')],
  },
];

export function createDemoInterventionsSource(): InterventionsSource {
  const items = createCollection(demoInterventions);
  const getOrFail = async (id: string): Promise<Intervention> => {
    const current = await items.get(id);
    if (!current) throw new Error(`Intervention introuvable : ${id}`);
    return current;
  };
  const trace = (label: string, detail = ''): HistoryEntry => ({ id: nextId('historique'), date: DEMO_TODAY, label, detail });
  return {
    list: () => items.list(),
    create: async (draft) => {
      const input = interventionInputSchema.parse(draft);
      const existing = (await items.list()).map((item) => item.id);
      return items.add({
        ...input,
        id: uniqueSlug(input.subject, existing, 'intervention'),
        status: 'ouverte',
        updatedAt: DEMO_TODAY,
        archived: false,
        quote: null,
        history: [
          trace('Intervention créée'),
          ...(input.intervenant ? [trace('Intervenant assigné', input.intervenant)] : []),
          ...(input.notifyTenant ? [trace('Locataire à prévenir', 'Notification activée à la création')] : []),
        ],
      });
    },
    update: async (id, draft) => {
      const input = interventionInputSchema.parse(draft);
      const current = await getOrFail(id);
      return items.update(id, { ...input, updatedAt: DEMO_TODAY, history: [...current.history, trace('Intervention modifiée')] });
    },
    assign: async (id, intervenant) => {
      const current = await getOrFail(id);
      const name = intervenant === null || intervenant.trim() === '' ? null : intervenant.trim();
      return items.update(id, {
        intervenant: name,
        updatedAt: DEMO_TODAY,
        history: [...current.history, name ? trace('Intervenant assigné', name) : trace('Intervenant retiré')],
      });
    },
    notifyTenant: async (id, message) => {
      const current = await getOrFail(id);
      const text = message.trim();
      if (text === '') throw new Error('Le message est vide.');
      return items.update(id, { updatedAt: DEMO_TODAY, history: [...current.history, trace('Locataire prévenu', text)] });
    },
    recordQuote: async (id, quote) => {
      const input = quoteInputSchema.parse(quote);
      const current = await getOrFail(id);
      return items.update(id, {
        quote: { ...input, status: 'a_valider' },
        updatedAt: DEMO_TODAY,
        history: [...current.history, trace('Devis reçu', formatMoney(input.amount, 'EUR'))],
      });
    },
    decideQuote: async (id, status) => {
      const current = await getOrFail(id);
      if (!current.quote) throw new Error('Aucun devis à traiter.');
      return items.update(id, {
        quote: { ...current.quote, status },
        updatedAt: DEMO_TODAY,
        history: [...current.history, trace(status === 'accepte' ? 'Devis accepté' : 'Devis refusé', formatMoney(current.quote.amount, 'EUR'))],
      });
    },
    setStatus: async (id, status) => {
      const current = await getOrFail(id);
      return items.update(id, { status, updatedAt: DEMO_TODAY, history: [...current.history, trace('État modifié', statusLabels[status])] });
    },
    setArchived: (id, archived) => items.update(id, { archived, updatedAt: DEMO_TODAY }),
    remove: (id) => items.remove(id),
  };
}
