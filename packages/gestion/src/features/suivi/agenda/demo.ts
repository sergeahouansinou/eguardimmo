import { createCollection } from '../../outils/kit';
import { uniqueSlug } from '../shared/ids';
import { eventInputSchema } from './schemas';
import type { AgendaEvent, Echeance } from './schemas';
import type { AgendaSource } from './source';

type EventSeed = Pick<AgendaEvent, 'id' | 'title' | 'kind' | 'date' | 'time' | 'bienId'> & Partial<AgendaEvent>;

const event = (seed: EventSeed): AgendaEvent => ({ recurrence: 'aucune', invitees: [], notes: '', reminder: false, ...seed });

export const demoEvents: readonly AgendaEvent[] = [
  event({ id: 'intervention-plombier', title: 'Intervention, plombier', kind: 'intervention', date: '2026-11-11', time: null, bienId: 'apt-a1' }),
  event({ id: 'renouvellement-de-l-assurance', title: "Renouvellement de l'assurance", kind: 'rappel', date: '2026-11-16', time: '11:00', bienId: 'residence-du-parc' }),
  event({ id: 'controle-de-la-chaudiere', title: 'Contrôle de la chaudière', kind: 'contrat', date: '2026-11-24', time: '09:30', bienId: 'villa-rdc' }),
  event({ id: 'anniversaire-de-koffi-adjovi', title: 'Anniversaire de Koffi Adjovi', kind: 'anniversaire', date: '2026-11-19', time: null, bienId: 'apt-a1', recurrence: 'annuelle' }),
  event({ id: 'visite-de-l-appartement-b3', title: "Visite de l'appartement B3", kind: 'visite', date: '2026-11-27', time: '15:30', bienId: 'apt-b3', invitees: ['Léa Martin'], notes: 'Apporter le dossier de présentation.', reminder: true }),
];

export const demoEcheances: readonly Echeance[] = [
  { id: 'loyer-de-novembre-rappel', title: 'Loyer de novembre, rappel', detail: 'Koffi Adjovi', date: '2026-11-16', time: '09:00', bienId: 'apt-a1' },
  { id: 'emission-des-avis-d-echeance', title: "Émission des avis d'échéance", detail: 'Tous les baux actifs', date: '2026-12-01', time: null, bienId: null },
];

export function createDemoAgendaSource(): AgendaSource {
  const events = createCollection(demoEvents);
  return {
    listEvents: () => events.list(),
    listEcheances: () => Promise.resolve(structuredClone([...demoEcheances])),
    createEvent: async (draft) => {
      const input = eventInputSchema.parse(draft);
      const existing = (await events.list()).map((item) => item.id);
      return events.add({ ...input, id: uniqueSlug(input.title, existing, 'evenement') });
    },
    icalUrl: () => Promise.resolve('https://agenda.eguardimmo.example/ical/7f3a9c1e-4b2d-48a6-9e0f-2c5d81b6a3e4.ics'),
  };
}
