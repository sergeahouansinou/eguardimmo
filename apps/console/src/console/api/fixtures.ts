export const IDS = {
  entry: '01934f6e-aaaa-7000-8000-000000000001',
  older: '01934f6e-aaaa-7000-8000-000000000002',
  actor: '01934f6e-bbbb-7000-8000-000000000001',
  org: '01934f6e-cccc-7000-8000-000000000001',
  request: '01934f6e-dddd-7000-8000-000000000001',
  subject: '01934f6e-eeee-7000-8000-000000000001',
  me: '01934f6e-ffff-7000-8000-000000000001',
};

export const activityEntry = {
  id: IDS.entry,
  occurred_at: '2026-11-14T10:00:00.000300+00:00',
  action: 'user.updated',
  actor: { id: IDS.actor, name: 'Jeanne Dupont', email: 'jeanne@exemple.fr' },
  organization_id: IDS.org,
  subject: { type: 'user', id: IDS.subject },
  changes: { name: { old: 'Jeanne', new: '[masqué]' }, active: { old: false, new: true }, roles: { old: null, new: ['admin'] } },
  metadata: { channel: 'web', attempts: 2 },
  request_id: IDS.request,
  route: 'identity.users.update',
  ip: '203.0.113.7',
  user_agent: 'Mozilla/5.0',
};

export const activityListResponse = {
  data: [
    activityEntry,
    {
      ...activityEntry,
      id: IDS.older,
      occurred_at: '2026-11-13T09:00:00.000000+00:00',
      action: 'console.activity.listed',
      actor: { id: IDS.me, name: null, email: null },
      organization_id: null,
      subject: null,
      changes: null,
      metadata: [],
      request_id: null,
      route: null,
      ip: null,
      user_agent: null,
    },
  ],
  links: { first: null, last: null, prev: null, next: 'http://api/api/v1/console/activity?cursor=abc' },
  meta: { path: 'http://api/api/v1/console/activity', per_page: 25, next_cursor: 'abc', prev_cursor: null },
};

export const activityDetailResponse = { data: activityEntry };

export const meResponse = {
  data: {
    id: IDS.me,
    name: 'Awa Diallo',
    email: 'awa.diallo@eguardimmo.test',
    email_verified_at: '2026-11-01T09:00:00+00:00',
    phone: null,
    last_login_at: '2026-11-16T08:30:00+00:00',
    previous_login_at: null,
    roles: ['admin'],
  },
};

export const notFoundProblem = { type: '/problems/not_found', title: 'Introuvable', status: 404, code: 'not_found', detail: 'Ressource introuvable.' };
export const forbiddenProblem = { type: '/problems/space_forbidden', title: 'Accès refusé', status: 403, code: 'space_forbidden', detail: 'Votre compte n’a pas accès à la console.' };
export const validationProblem = {
  type: '/problems/validation_failed',
  title: 'Données invalides',
  status: 422,
  code: 'validation_failed',
  errors: { cursor: ['Curseur invalide.'] },
};
