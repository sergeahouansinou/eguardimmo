import { createCollection, DEMO_TODAY } from '../../outils/kit';
import { uniqueSlug } from '../shared/ids';
import { interventionInputSchema } from './schemas';
import type { Intervention } from './schemas';
import type { InterventionsSource } from './source';

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
  },
];

export function createDemoInterventionsSource(): InterventionsSource {
  const items = createCollection(demoInterventions);
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
      });
    },
    setStatus: (id, status) => items.update(id, { status, updatedAt: DEMO_TODAY }),
    setArchived: (id, archived) => items.update(id, { archived, updatedAt: DEMO_TODAY }),
    remove: (id) => items.remove(id),
  };
}
