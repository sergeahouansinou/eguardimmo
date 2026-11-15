import { createCollection } from '../../outils/kit';
import { addDays } from '../shared/dates';
import { uniqueSlug } from '../shared/ids';
import { taskInputSchema } from './schemas';
import type { Task } from './schemas';
import type { TasksSource } from './source';

const email = (daysBefore: number) => ({ channel: 'email', daysBefore }) as const;

const open: Task[] = [
  { id: 'attestation-d-assurance-a-demander', title: "Attestation d'assurance à demander", bienId: 'apt-a1', assignee: 'Marie Chabi', dueDate: '2026-11-10', reminder: email(7), done: false },
  { id: 'revision-du-loyer-irl-t3', title: 'Révision du loyer, IRL T3', bienId: 'villa-rdc', assignee: 'Marie Chabi', dueDate: '2026-11-12', reminder: email(15), done: false },
  { id: 'releve-des-compteurs', title: 'Relevé des compteurs', bienId: 'apt-b3', assignee: 'Paul Agossou', dueDate: '2026-11-20', reminder: { channel: 'notification', daysBefore: 2 }, done: false },
  { id: 'renouvellement-assurance-pno', title: 'Renouvellement assurance PNO', bienId: 'les-tilleuls', assignee: 'Marie Chabi', dueDate: '2026-12-01', reminder: email(15), done: false },
  { id: 'ramonage-annuel', title: 'Ramonage annuel', bienId: 'villa-rdc', assignee: 'Paul Agossou', dueDate: '2026-12-15', reminder: email(30), done: false },
  { id: 'verification-des-detecteurs-de-fumee', title: 'Vérification des détecteurs de fumée', bienId: 'residence-du-parc', assignee: 'Marie Chabi', dueDate: '2026-12-18', reminder: email(7), done: false },
];

const doneRows = [
  ['Quittances d’octobre à envoyer', 'les-tilleuls', 'Marie Chabi', '2026-11-05'],
  ['Relance du loyer de septembre', 'apt-a1', 'Marie Chabi', '2026-10-12'],
  ['Appel du syndic pour les charges', 'residence-du-parc', 'Marie Chabi', '2026-10-09'],
  ['Photos de l’état des lieux de sortie', 'apt-b3', 'Paul Agossou', '2026-10-02'],
  ['Remise des clés au nouveau locataire', 'apt-b3', 'Paul Agossou', '2026-10-01'],
  ['Devis peinture cage d’escalier', 'residence-du-parc', 'Marie Chabi', '2026-09-28'],
  ['Relevé des compteurs de septembre', 'apt-a1', 'Paul Agossou', '2026-09-20'],
  ['Contrôle de l’extincteur', 'residence-du-parc', 'Paul Agossou', '2026-09-15'],
  ['Envoi de l’avis d’échéance d’octobre', 'les-tilleuls', 'Marie Chabi', '2026-09-25'],
  ['Visite de la toiture', 'villa-rdc', 'Paul Agossou', '2026-09-10'],
  ['Renouvellement du bail de Villa RDC', 'villa-rdc', 'Marie Chabi', '2026-09-01'],
  ['Révision du loyer, IRL T2', 'apt-a1', 'Marie Chabi', '2026-08-12'],
  ['Entretien de la chaudière', 'villa-rdc', 'Paul Agossou', '2026-08-05'],
  ['Attestation d’assurance de Villa RDC', 'villa-rdc', 'Marie Chabi', '2026-07-30'],
  ['Remplacement des joints de la salle de bains', 'apt-b3', 'Paul Agossou', '2026-07-18'],
  ['Déclaration des revenus fonciers', 'les-tilleuls', 'Marie Chabi', '2026-06-20'],
  ['Taille de la haie', 'villa-rdc', 'Paul Agossou', '2026-06-05'],
  ['Mise à jour du diagnostic de performance énergétique', 'apt-a1', 'Marie Chabi', '2026-05-28'],
] as const;

const doneTasks: Task[] = doneRows.map(([title, bienId, assignee, dueDate], index) => ({
  id: `${String(index + 1).padStart(2, '0')}-${title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`,
  title,
  bienId,
  assignee,
  dueDate,
  reminder: email(7),
  done: true,
}));

export const demoTasks: readonly Task[] = [...open, ...doneTasks];

export function createDemoTasksSource(): TasksSource {
  const items = createCollection(demoTasks);
  return {
    list: () => items.list(),
    create: async (draft) => {
      const input = taskInputSchema.parse(draft);
      const existing = (await items.list()).map((item) => item.id);
      return items.add({ ...input, id: uniqueSlug(input.title, existing, 'tache'), done: false });
    },
    setDone: (id, done) => items.update(id, { done }),
    postpone: async (ids, days) => {
      const current = await items.list();
      const unknown = ids.filter((id) => !current.some((item) => item.id === id));
      if (unknown.length > 0) throw new Error(`Tâches introuvables : ${unknown.join(', ')}`);
      await Promise.all(
        current.filter((item) => ids.includes(item.id)).map((item) => items.update(item.id, { dueDate: addDays(item.dueDate, days) })),
      );
    },
    complete: async (ids) => {
      await Promise.all(ids.map((id) => items.update(id, { done: true })));
    },
    remove: (id) => items.remove(id),
  };
}
