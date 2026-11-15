import { addDays } from '../shared/dates';
import type { EventType, JournalEvent } from './schemas';

interface Actor {
  id: string;
  name: string;
  initials: string;
  origin: string;
  device: string;
}

const MARC: Actor = { id: 'marc-chevalier', name: 'Marc Chevalier', initials: 'MC', origin: '81.250.xx.xx, Paris', device: 'Chrome, macOS' };
const AWA: Actor = { id: 'awa-diallo', name: 'Awa Diallo', initials: 'AD', origin: '92.184.xx.xx, Lyon', device: 'Chrome, Windows' };
const JULIEN: Actor = { id: 'julien-morel', name: 'Julien Morel', initials: 'JM', origin: '176.143.xx.xx, Nantes', device: 'Safari, iPad' };

function event(
  rank: number,
  at: string,
  actor: Actor,
  type: EventType,
  action: string,
  detail: string,
  extra: Partial<Pick<JournalEvent, 'before' | 'after' | 'device' | 'fingerprint' | 'id'>> = {},
): JournalEvent {
  const hex = ((rank * 2654435761) >>> 0).toString(16).padStart(8, '0');
  return {
    id: extra.id ?? `EVT-2026-${String(118402 - rank)}`,
    at,
    memberId: actor.id,
    member: actor.name,
    initials: actor.initials,
    type,
    action,
    detail,
    origin: actor.origin,
    device: extra.device ?? actor.device,
    fingerprint: extra.fingerprint ?? `${hex.slice(0, 4)}…${hex.slice(4)}`,
    ...(extra.before === undefined ? {} : { before: extra.before }),
    ...(extra.after === undefined ? {} : { after: extra.after }),
  };
}

const HEAD: JournalEvent[] = [
  event(0, '2026-11-13T14:52:07+01:00', MARC, 'droits', 'A changé le rôle de Fatou Ndiaye', 'Gestionnaire → Comptable', {
    before: 'Gestionnaire',
    after: 'Comptable',
    fingerprint: 'a91c…04be',
  }),
  event(1, '2026-11-13T14:47:31+01:00', MARC, 'droits', 'A invité Fatou Ndiaye', 'Rôle Comptable, tous les biens'),
  event(2, '2026-11-13T11:06:12+01:00', AWA, 'paiement', 'A enregistré un paiement de 990 €', 'Nadège Sossou, Apt A2'),
  event(3, '2026-11-13T11:04:48+01:00', AWA, 'document', 'A émis la quittance QT-2026-0412', 'Scellée, empreinte 3f2a…9c1e'),
  event(4, '2026-11-13T08:42:19+01:00', AWA, 'connexion', "S'est connectée", 'Application mobile, iPhone', {
    device: 'Application mobile, iPhone',
  }),
  event(5, '2026-11-12T18:20:55+01:00', MARC, 'export', 'A exporté le rapport Loyers encaissés', 'Excel, année 2026'),
  event(6, '2026-11-12T09:15:03+01:00', JULIEN, 'securite', 'Connexion refusée', 'Double authentification non activée'),
];

const FILLER_TEMPLATES: readonly { actor: Actor; type: EventType; action: string; detail: string }[] = [
  { actor: AWA, type: 'connexion', action: "S'est connectée", detail: 'Navigateur web' },
  { actor: MARC, type: 'paiement', action: 'A enregistré un paiement de 850 €', detail: 'Koffi Adjovi, Apt A1' },
  { actor: AWA, type: 'document', action: 'A émis la quittance QT-2026-0398', detail: 'Scellée, empreinte 7d10…c2a4' },
  { actor: MARC, type: 'connexion', action: "S'est connecté", detail: 'Navigateur web' },
  { actor: AWA, type: 'paiement', action: 'A enregistré un paiement de 1 150 €', detail: 'Marc Dossou, Villa RDC' },
  { actor: MARC, type: 'export', action: 'A exporté la liste des locataires', detail: 'CSV, tous les biens' },
  { actor: JULIEN, type: 'securite', action: 'Connexion refusée', detail: 'Double authentification non activée' },
  { actor: AWA, type: 'document', action: "A envoyé l'avis d'échéance AV-2026-1101-A1", detail: 'Koffi Adjovi, par e-mail' },
  { actor: MARC, type: 'droits', action: 'A modifié les biens accessibles de Julien Morel', detail: 'Les Tilleuls' },
];

const FILLER_COUNT = 177;

function filler(index: number): JournalEvent {
  const template = FILLER_TEMPLATES[index % FILLER_TEMPLATES.length] ?? FILLER_TEMPLATES[0];
  if (!template) throw new RangeError('Aucun modèle de journal');
  const dayOffset = Math.floor(index / 16);
  const slot = index % 16;
  const minutes = dayOffset === 0 ? 5 + slot * 30 : 8 * 60 + slot * 35;
  const day = addDays('2026-11-12', -dayOffset);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return event(index + 7, `${day}T${hh}:${mm}:${String((index * 7) % 60).padStart(2, '0')}+01:00`, template.actor, template.type, template.action, template.detail);
}

export function demoJournalEvents(): JournalEvent[] {
  return [...HEAD, ...Array.from({ length: FILLER_COUNT }, (_, index) => filler(index))];
}
