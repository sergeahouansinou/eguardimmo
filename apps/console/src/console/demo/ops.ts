import type { Backup } from '../schemas/sauvegardes';
import type { QueueRow, ServiceRow } from '../schemas/sante';
import { addDays } from './clock';

export interface IncidentRecord {
  id: string;
  code: string;
  title: string;
  summary: string;
  state: 'en_cours' | 'resolu';
  severity: 1 | 2 | 3;
  openedAt: string;
  resolvedAt: string | null;
  owner: string;
  moduleId: string | null;
  organisations: number;
  pendingMessages: number;
  metrics: { label: string; value: string; caption: string }[];
  timeline: { id: string; at: string; title: string; detail: string; tone?: 'default' | 'success' | 'warning' | 'danger' }[];
  communication: { publishedAt: string; message: string; diffusion: string; nextUpdate: string } | null;
  impacted: { id: string; name: string; detail: string }[];
  runbook: { code: string; title: string; steps: string[] } | null;
}

export const SERVICES: ServiceRow[] = [
  { id: 'api', name: 'API Laravel', state: 'operational', latencyMs: 184, availabilityBp: 9995 },
  { id: 'portail', name: 'Portail web', state: 'operational', latencyMs: 92, availabilityBp: 9998 },
  { id: 'mobile', name: 'Application mobile', state: 'operational', latencyMs: 171, availabilityBp: 9995 },
  { id: 'base', name: 'Base de données principale', state: 'operational', latencyMs: 6, availabilityBp: 9999 },
  { id: 'redis', name: 'Cache Redis', state: 'operational', latencyMs: 1, availabilityBp: 9999 },
  { id: 'stockage', name: 'Stockage des documents', state: 'operational', latencyMs: 48, availabilityBp: 9997 },
  { id: 'smtp', name: 'Relais SMTP', state: 'operational', latencyMs: 310, availabilityBp: 9992 },
  { id: 'file-emails', name: "File d'envoi des e-mails", state: 'degraded', latencyMs: 260_000, availabilityBp: 9971 },
];

export const QUEUES: QueueRow[] = [
  { id: 'emails', name: 'Envoi des e-mails', pending: 1842, oldestSeconds: 1260, slow: true },
  { id: 'pdf', name: 'Documents PDF', pending: 37, oldestSeconds: 12, slow: false },
  { id: 'push', name: 'Notifications push', pending: 22, oldestSeconds: 3, slow: false },
  { id: 'scellement', name: 'Scellement des quittances', pending: 11, oldestSeconds: 8, slow: false },
  { id: 'reversements', name: 'Reversements', pending: 0, oldestSeconds: null, slow: false },
];

export const LATENCY = [
  { label: '10h', ms: 172 },
  { label: '12h', ms: 168 },
  { label: '14h', ms: 175 },
  { label: '16h', ms: 181 },
  { label: '18h', ms: 190 },
  { label: '20h', ms: 186 },
  { label: '22h', ms: 179 },
  { label: '00h', ms: 192 },
  { label: '02h', ms: 201 },
  { label: '04h', ms: 188 },
  { label: '06h', ms: 184 },
  { label: '08h', ms: 184 },
];

export const RUNBOOK_01 = {
  code: 'RUN-01',
  title: "File d'envoi saturée",
  steps: [
    'Vérifier la taille de la file et le plus ancien message en attente.',
    'Activer le drapeau messagerie.limitation_debit pour protéger le relais SMTP.',
    'Ajouter des workers à la file d’envoi des e-mails.',
    'Publier un message aux organisations touchées, avec l’heure du prochain point.',
    'Surveiller la baisse de la file puis lever la limitation.',
  ],
};

export function buildIncident(): IncidentRecord {
  return {
    id: 'inc-2026-031',
    code: 'INC-2026-031',
    title: 'Messagerie dégradée',
    summary: "La file d'envoi des e-mails est ralentie.",
    state: 'en_cours',
    severity: 2,
    openedAt: '2026-11-13T20:42:00+01:00',
    resolvedAt: null,
    owner: 'Théo Marchand',
    moduleId: 'messagerie',
    organisations: 118,
    pendingMessages: 1842,
    metrics: [
      { label: 'Messages en attente', value: '1 842', caption: 'Pic à 2 110 à 21:05' },
      { label: "Délai moyen d'envoi", value: '4 min 20 s', caption: 'Habituel : 8 secondes' },
      { label: 'Organisations touchées', value: '118', caption: 'sur 128, aucune perte de message' },
      { label: 'Cause probable', value: 'Worker saturé', caption: "File d'envoi des e-mails" },
    ],
    timeline: [
      { id: 'i1', at: '2026-11-13T20:42:00+01:00', title: 'Alerte automatique', detail: "File d'envoi supérieure à 500 messages · Système" },
      { id: 'i2', at: '2026-11-13T20:47:00+01:00', title: 'Incident ouvert', detail: 'Sévérité 2 · Théo Marchand' },
      { id: 'i3', at: '2026-11-13T20:55:00+01:00', title: 'Limitation du débit activée', detail: '200 messages par minute · drapeau messagerie.limitation_debit' },
      { id: 'i4', at: '2026-11-13T21:02:00+01:00', title: 'Premier ticket client', detail: 'SUP-2094 · Gestion Les Tilleuls' },
      { id: 'i5', at: '2026-11-13T21:10:00+01:00', title: 'Deux workers ajoutés', detail: "Montée en charge de la file d'envoi · Théo Marchand" },
      { id: 'i6', at: '2026-11-13T21:16:00+01:00', title: 'Message publié aux organisations', detail: "Bandeau dans l'application · Inès Garnier" },
      { id: 'i7', at: '2026-11-13T21:30:00+01:00', title: 'File en baisse', detail: '1 842 messages, délai moyen 4 min 20 s · surveillance en cours' },
    ],
    communication: {
      publishedAt: '2026-11-13T21:16:00+01:00',
      message: 'Les e-mails sont envoyés avec quelques minutes de retard. Aucun message n’est perdu : les relances et les campagnes partiront dès le retour à la normale.',
      diffusion: 'Bandeau, 118 organisations',
      nextUpdate: '22:00',
    },
    impacted: [
      { id: 'impayes', name: 'Impayés', detail: 'Relances retardées' },
      { id: 'quittances', name: 'Quittances', detail: 'Envoi des avis retardé' },
      { id: 'campagnes', name: 'Campagnes', detail: 'Décalées de quelques minutes' },
    ],
    runbook: RUNBOOK_01,
  };
}

export function buildBackups(): Backup[] {
  const backups: Backup[] = [];
  for (let offset = 0; offset < 30; offset += 1) {
    const day = addDays('2026-11-13', -offset);
    backups.push({
      id: `sauvegarde-${day}-0300`,
      name: `sauvegarde-${day}-0300`,
      at: `${day}T03:00:00+01:00`,
      kind: 'quotidienne',
      sizeMb: 38_400 - offset * 100,
      durationMinutes: offset % 3 === 2 ? 13 : 14,
      success: true,
    });
  }
  const months = ['2026-11-01', '2026-10-01', '2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01', '2026-02-01', '2026-01-01', '2025-12-01'];
  months.forEach((day, index) => {
    backups.push({
      id: `sauvegarde-${day}-0200`,
      name: `sauvegarde-${day}-0200`,
      at: `${day}T02:00:00+01:00`,
      kind: 'mensuelle',
      sizeMb: 37_600 - index * 400,
      durationMinutes: 15,
      success: true,
    });
  });
  return backups.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
}

export const BACKUP_TESTS = [
  { id: 'test-2026-11-05', on: '2026-11-05', durationMinutes: 22, detail: 'Environnement isolé · 22 min · intégrité vérifiée', success: true },
  { id: 'test-2026-08-05', on: '2026-08-05', durationMinutes: 21, detail: 'Environnement isolé · 21 min · intégrité vérifiée', success: true },
];
