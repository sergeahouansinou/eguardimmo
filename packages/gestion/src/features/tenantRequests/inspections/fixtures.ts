import { IDS } from '../testing/fixtures';

export const INSPECTION_IDS = {
  entry: '01934f6e-0000-7000-8000-000000000501',
  exit: '01934f6e-0000-7000-8000-000000000502',
  published: '01934f6e-0000-7000-8000-000000000503',
  file: '01934f6e-0000-7000-8000-000000000511',
  remarkOpen: '01934f6e-0000-7000-8000-000000000521',
  remarkAnswered: '01934f6e-0000-7000-8000-000000000522',
  photo: '01934f6e-0000-7000-8000-000000000531',
} as const;

export const inspectionEntry = {
  id: INSPECTION_IDS.entry,
  lease_id: IDS.lease,
  kind: 'entry',
  performed_on: '2026-01-03',
  performed_by: 'agent',
  signatories: [
    { name: 'Awa Diallo', capacity: 'Locataire', date: '2026-01-03' },
    { name: 'Sophie Martin', capacity: 'Agente immobilière', date: '2026-01-03' },
  ],
  exit_matches_entry: null,
  stored_file_id: INSPECTION_IDS.file,
  published_at: null,
  published_by_user_id: null,
  created_by_user_id: IDS.user,
  lock_version: 1,
  created_at: '2026-01-04T09:00:00+00:00',
};

export const inspectionExit = { ...inspectionEntry, id: INSPECTION_IDS.exit, kind: 'exit', performed_on: '2026-11-10', signatories: [] };

export const inspectionPublished = {
  ...inspectionEntry,
  id: INSPECTION_IDS.published,
  published_at: '2026-01-05T08:00:00+00:00',
  published_by_user_id: IDS.user,
  lock_version: 2,
};

export const remarkOpen = {
  id: INSPECTION_IDS.remarkOpen,
  inspection_id: INSPECTION_IDS.entry,
  party_id: IDS.partyAwa,
  kind: 'complement',
  body: 'Des traces d’humidité sont visibles dans la salle de bains.',
  status: 'open',
  answer: null,
  answer_body: null,
  answered_by_user_id: null,
  answered_at: null,
  photos: [{ id: INSPECTION_IDS.photo, position: 0 }],
  created_at: '2026-01-06T10:00:00+00:00',
};

export const remarkAnswered = {
  ...remarkOpen,
  id: INSPECTION_IDS.remarkAnswered,
  party_id: IDS.partyMarc,
  kind: 'heating',
  body: 'Le radiateur du séjour ne chauffe pas.',
  status: 'answered',
  answer: 'accepted',
  answer_body: 'Ajouté à l’état d’entrée.',
  answered_by_user_id: IDS.user,
  answered_at: '2026-01-07T10:00:00+00:00',
  photos: [],
};
