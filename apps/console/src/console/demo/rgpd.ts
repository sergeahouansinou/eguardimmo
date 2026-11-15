import type { RgpdDetail, RgpdState, RgpdStep, RgpdType } from '../schemas/rgpd';
import { addDays, addMonths } from './clock';
import type { OrgRecord } from './organisations';
import { FIRST_NAMES, LAST_NAMES, createRandom, pick } from './random';

export interface RgpdRecord {
  id: string;
  requester: string;
  email: string;
  type: RgpdType;
  organisationId: string;
  receivedOn: string;
  channel: string;
  profile: string;
  steps: RgpdStep[];
  timeline: RgpdDetail['timeline'];
  messages: RgpdDetail['messages'];
}

export const RGPD_TOTAL = 28;
export const GENERATED_CLOSED = 22;

type StepSeed = Omit<RgpdStep, 'doneOn' | 'detail'>;

const STEP_SEEDS: Record<RgpdType, StepSeed[]> = {
  effacement: [
    { key: 'recue', label: 'Demande reçue', actionLabel: 'Enregistrer la demande', strong: false },
    { key: 'identite', label: 'Identité vérifiée', actionLabel: "Vérifier l'identité", strong: false },
    { key: 'perimetre', label: 'Périmètre à valider', actionLabel: 'Valider le périmètre', strong: false },
    { key: 'execution', label: 'Effacement exécuté', actionLabel: "Exécuter l'effacement", strong: true },
    { key: 'reponse', label: 'Réponse envoyée', actionLabel: 'Envoyer la réponse', strong: false },
  ],
  acces: [
    { key: 'recue', label: 'Demande reçue', actionLabel: 'Enregistrer la demande', strong: false },
    { key: 'identite', label: 'Identité vérifiée', actionLabel: "Vérifier l'identité", strong: false },
    { key: 'donnees', label: 'Données réunies', actionLabel: 'Valider les données réunies', strong: false },
    { key: 'reponse', label: 'Réponse envoyée', actionLabel: 'Envoyer la réponse', strong: false },
  ],
  rectification: [
    { key: 'recue', label: 'Demande reçue', actionLabel: 'Enregistrer la demande', strong: false },
    { key: 'identite', label: 'Identité vérifiée', actionLabel: "Vérifier l'identité", strong: false },
    { key: 'correction', label: 'Rectification appliquée', actionLabel: 'Appliquer la rectification', strong: false },
    { key: 'reponse', label: 'Réponse envoyée', actionLabel: 'Envoyer la réponse', strong: false },
  ],
};

export function buildSteps(type: RgpdType, doneDates: (string | null)[], details: Record<string, string> = {}): RgpdStep[] {
  return STEP_SEEDS[type].map((seed, index) => ({
    ...seed,
    doneOn: doneDates[index] ?? null,
    detail: details[seed.key] ?? null,
  }));
}

export function deriveState(steps: readonly RgpdStep[]): RgpdState {
  const done = steps.filter((step) => step.doneOn !== null).length;
  if (done === steps.length) return 'cloturee';
  return done >= 3 ? 'en_cours' : 'a_traiter';
}

export function dueDate(receivedOn: string): string {
  return addMonths(receivedOn, 1);
}

const ERASURE_SCOPE: RgpdDetail['scope'] = [
  { id: 'compte', title: 'Compte et identifiants', detail: 'Authentification · anonymisation du compte', action: 'effacer' },
  { id: 'coordonnees', title: "Coordonnées et pièce d'identité", detail: 'Documents · suppression des fichiers', action: 'effacer' },
  { id: 'messages', title: 'Messages et pièces jointes', detail: 'Messagerie · 14 conversations', action: 'effacer' },
  { id: 'preferences', title: 'Préférences et notifications', detail: 'Notifications · jetons push', action: 'effacer' },
  { id: 'mandat', title: 'Mandat M-2024-0033 signé', detail: 'Mandats · registre des mandats, 10 ans', action: 'conserver' },
  { id: 'reversements', title: 'Comptes rendus et reversements', detail: 'Reversements · obligation comptable, 10 ans', action: 'conserver' },
  { id: 'quittances', title: 'Baux et quittances de ses 2 lots', detail: 'Quittances · scellées, intégrité préservée', action: 'conserver' },
  { id: 'audit', title: "Journal d'audit", detail: 'Preuve et sécurité · conservation 5 ans', action: 'conserver' },
];

const ACCESS_SCOPE: RgpdDetail['scope'] = [
  { id: 'compte', title: 'Compte et identifiants', detail: 'Authentification · export au format lisible', action: 'exporter' },
  { id: 'baux', title: 'Baux et quittances', detail: 'Baux, Quittances · copie des documents', action: 'exporter' },
  { id: 'messages', title: 'Messages et pièces jointes', detail: 'Messagerie · conversations du demandeur', action: 'exporter' },
  { id: 'journal', title: 'Connexions et accès', detail: "Journal d'audit · 12 derniers mois", action: 'exporter' },
];

const RECTIFICATION_SCOPE: RgpdDetail['scope'] = [
  { id: 'identite', title: 'Identité et coordonnées', detail: 'Authentification · champs à corriger', action: 'corriger' },
  { id: 'baux', title: 'Données du bail', detail: 'Baux · mention de la partie concernée', action: 'corriger' },
];

export function scopeFor(type: RgpdType): RgpdDetail['scope'] {
  return { effacement: ERASURE_SCOPE, acces: ACCESS_SCOPE, rectification: RECTIFICATION_SCOPE }[type];
}

export function buildRgpd(organisations: readonly OrgRecord[]): RgpdRecord[] {
  const delmas = 'cabinet-delmas-immobilier';
  const tilleuls = 'gestion-les-tilleuls';
  const named: RgpdRecord[] = [
    {
      id: 'anais-roux-acces',
      requester: 'Anaïs Roux',
      email: 'anais.roux@example.com',
      type: 'acces',
      organisationId: delmas,
      receivedOn: '2026-11-06',
      channel: 'Formulaire en ligne',
      profile: 'Locataire',
      steps: buildSteps('acces', ['2026-11-06', null, null, null]),
      timeline: [{ id: 't1', date: '2026-11-06', title: 'Demande reçue', detail: 'Formulaire en ligne · enregistrée au registre' }],
      messages: [],
    },
    {
      id: 'paul-lemoine-effacement',
      requester: 'Paul Lemoine',
      email: 'paul.lemoine@example.com',
      type: 'effacement',
      organisationId: delmas,
      receivedOn: '2026-11-10',
      channel: 'E-mail au DPO',
      profile: 'Propriétaire, mandant',
      steps: buildSteps('effacement', ['2026-11-10', '2026-11-12', null, null, null]),
      timeline: [
        { id: 't1', date: '2026-11-10', title: 'Demande reçue', detail: 'E-mail au DPO · enregistrée au registre' },
        { id: 't2', date: '2026-11-12', title: 'Identité vérifiée', detail: 'Pièce comparée · Karim Haddad' },
        { id: 't3', date: '2026-11-13', title: 'Périmètre en cours', detail: 'À valider avant l’exécution' },
      ],
      messages: [],
    },
    {
      id: 'louis-petit-rectification',
      requester: 'Louis Petit',
      email: 'louis.petit@example.com',
      type: 'rectification',
      organisationId: tilleuls,
      receivedOn: '2026-11-12',
      channel: 'Formulaire en ligne',
      profile: 'Locataire',
      steps: buildSteps('rectification', ['2026-11-12', null, null, null]),
      timeline: [{ id: 't1', date: '2026-11-12', title: 'Demande reçue', detail: 'Formulaire en ligne · enregistrée au registre' }],
      messages: [],
    },
    {
      id: 'nadia-benali-acces',
      requester: 'Nadia Benali',
      email: 'nadia.benali@example.com',
      type: 'acces',
      organisationId: delmas,
      receivedOn: '2026-10-29',
      channel: 'E-mail au DPO',
      profile: 'Locataire',
      steps: buildSteps('acces', ['2026-10-29', '2026-10-30', '2026-11-05', null], { donnees: 'Pièces à réunir auprès de l’organisation' }),
      timeline: [
        { id: 't1', date: '2026-10-29', title: 'Demande reçue', detail: 'E-mail au DPO · enregistrée au registre' },
        { id: 't2', date: '2026-10-30', title: 'Identité vérifiée', detail: 'Pièce comparée · Karim Haddad' },
        { id: 't3', date: '2026-11-05', title: 'Données réunies', detail: 'Pièces à réunir auprès de l’organisation' },
      ],
      messages: [],
    },
    {
      id: 'sarah-mensah-acces',
      requester: 'Sarah Mensah',
      email: 'sarah.mensah@example.com',
      type: 'acces',
      organisationId: 'sci-les-acacias',
      receivedOn: '2026-10-14',
      channel: 'E-mail au DPO',
      profile: 'Propriétaire',
      steps: buildSteps('acces', ['2026-10-14', '2026-10-15', '2026-10-19', '2026-10-21']),
      timeline: [
        { id: 't1', date: '2026-10-14', title: 'Demande reçue', detail: 'E-mail au DPO · enregistrée au registre' },
        { id: 't2', date: '2026-10-21', title: 'Réponse envoyée', detail: 'Demande clôturée dans le délai' },
      ],
      messages: [],
    },
    {
      id: 'thomas-girard-rectification',
      requester: 'Thomas Girard',
      email: 'thomas.girard@example.com',
      type: 'rectification',
      organisationId: tilleuls,
      receivedOn: '2026-10-02',
      channel: 'Formulaire en ligne',
      profile: 'Locataire',
      steps: buildSteps('rectification', ['2026-10-02', '2026-10-03', '2026-10-07', '2026-10-09']),
      timeline: [
        { id: 't1', date: '2026-10-02', title: 'Demande reçue', detail: 'Formulaire en ligne · enregistrée au registre' },
        { id: 't2', date: '2026-10-09', title: 'Réponse envoyée', detail: 'Demande clôturée dans le délai' },
      ],
      messages: [],
    },
  ];

  const random = createRandom(28);
  const used = new Set(named.map((record) => record.id));
  const types: RgpdType[] = ['acces', 'rectification', 'effacement'];
  const durations = [...Array<number>(18).fill(9), ...Array<number>(4).fill(10)];
  for (let index = 0; index < GENERATED_CLOSED; index += 1) {
    const first = pick(random, FIRST_NAMES);
    const last = pick(random, LAST_NAMES);
    const type = types[index % types.length] ?? 'acces';
    let id = `${first}-${last}-${type}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    if (used.has(id)) id = `${id}-${String(index)}`;
    used.add(id);
    const receivedOn = addDays('2026-10-01', -(index * 12 + Math.floor(random() * 8)));
    const closedOn = addDays(receivedOn, durations[index] ?? 9);
    const org = organisations[Math.floor(random() * organisations.length)];
    const seeds = STEP_SEEDS[type].length;
    const done = STEP_SEEDS[type].map((_, step) => (step === seeds - 1 ? closedOn : addDays(receivedOn, Math.min(step * 2, durations[index] ?? 9))));
    named.push({
      id,
      requester: `${first} ${last}`,
      email: `${id}@example.com`,
      type,
      organisationId: org?.id ?? delmas,
      receivedOn,
      channel: 'Formulaire en ligne',
      profile: 'Locataire',
      steps: buildSteps(type, done),
      timeline: [
        { id: 't1', date: receivedOn, title: 'Demande reçue', detail: 'Formulaire en ligne · enregistrée au registre' },
        { id: 't2', date: closedOn, title: 'Réponse envoyée', detail: 'Demande clôturée dans le délai' },
      ],
      messages: [],
    });
  }
  return named;
}
