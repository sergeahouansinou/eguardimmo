export const ACCOUNT_IDS = {
  user: '01a1e967-3934-7225-bc4b-e57ff0867fd5',
  organization: '0199a1b2-7c3d-7e4f-8a5b-9a8b7c6d5e4f',
  currentDevice: '01a1e967-393d-7062-a9ff-a2cbeb3fb18b',
  otherDevice: '01a1e967-393e-733d-ab52-e64b66cfced0',
} as const;

export const meResponse = {
  data: {
    id: ACCOUNT_IDS.user,
    name: 'Jeanne Martin',
    email: 'jeanne@exemple.fr',
    email_verified_at: '2026-11-17T12:06:58+00:00',
    last_login_at: '2026-11-14T18:30:00+00:00',
    previous_login_at: '2026-11-10T09:00:00+00:00',
  },
};

export const profilesResponse = {
  data: [
    { space: 'organization', label: 'Agence Les Tilleuls', meta: { organization: ACCOUNT_IDS.organization, kind: 'agency', role: 'owner' } },
    { space: 'tenant', label: 'Locataire', meta: { links: 1 } },
  ],
};

export const noProfilesResponse = { data: [] };

export const devicesResponse = {
  data: [
    {
      id: ACCOUNT_IDS.otherDevice,
      name: 'Pixel 9',
      last_used_at: null,
      created_at: '2026-11-17T12:06:58+00:00',
      expires_at: null,
      current: false,
    },
    {
      id: ACCOUNT_IDS.currentDevice,
      name: 'iPhone de Jeanne',
      last_used_at: '2026-11-17T12:06:58+00:00',
      created_at: '2026-11-17T12:06:58+00:00',
      expires_at: null,
      current: true,
    },
  ],
};

export const devicesAfterRevocation = { data: devicesResponse.data.filter((device) => device.id !== ACCOUNT_IDS.otherDevice) };

export const noDevicesResponse = { data: [] };

const securityDevices = [
  { id: ACCOUNT_IDS.otherDevice, name: 'Pixel 9', type: 'mobile', last_activity_at: '2026-11-17T12:06:58+00:00', current: false },
  { id: ACCOUNT_IDS.currentDevice, name: 'iPhone de Jeanne', type: 'mobile', last_activity_at: '2026-11-17T12:06:58+00:00', current: true },
];

export const securityResponse = {
  data: {
    email: 'jeanne@exemple.fr',
    email_verified: true,
    has_password: true,
    two_factor: { enabled: false, enabled_at: null, backup_codes_remaining: 0, backup_codes_total: 0 },
    linked_accounts: [
      { provider: 'google', linked: false, email: null, linked_at: null },
      { provider: 'apple', linked: false, email: null, linked_at: null },
    ],
    devices: securityDevices,
    confirmed_until: null,
    confirmed_with_code_until: null,
  },
};

export const securityWithTwoFactorResponse = {
  data: {
    ...securityResponse.data,
    two_factor: { enabled: true, enabled_at: '2026-11-12T08:15:00+00:00', backup_codes_remaining: 6, backup_codes_total: 8 },
    linked_accounts: [
      { provider: 'google', linked: true, email: 'jeanne@gmail.test', linked_at: '2026-11-11T10:00:00+00:00' },
      { provider: 'apple', linked: false, email: null, linked_at: null },
    ],
  },
};

export const unauthenticatedProblem = {
  type: 'https://api.eguardimmo.test/problems/unauthenticated',
  title: 'Non authentifié',
  status: 401,
  detail: 'Connectez-vous pour continuer.',
  code: 'unauthenticated',
  request_id: '01a1e967-3969-708c-86ab-cd8bbf54551d',
};

export const notFoundProblem = {
  type: 'https://api.eguardimmo.test/problems/not_found',
  title: 'Introuvable',
  status: 404,
  detail: 'La ressource demandée est introuvable.',
  code: 'not_found',
  request_id: '01a1e967-3969-708c-86ab-cd8bbf54551d',
};

export const tooManyRequestsProblem = {
  type: 'https://api.eguardimmo.test/problems/too_many_requests',
  title: 'Trop de tentatives',
  status: 429,
  detail: 'Trop de tentatives. Réessayez plus tard.',
  code: 'too_many_requests',
  retry_after: 42,
  request_id: '01a1e967-3969-708c-86ab-cd8bbf54551d',
};

export const serverErrorProblem = {
  type: 'https://api.eguardimmo.test/problems/server_error',
  title: 'Erreur interne',
  status: 500,
  detail: 'Une erreur interne est survenue. Réessayez plus tard.',
  code: 'server_error',
  request_id: '01a1e967-3969-708c-86ab-cd8bbf54551d',
};
