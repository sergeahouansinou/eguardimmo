// Formes de TenantStatementResource et du contrôleur de liste, écrites à la main d'après le code du backend (jamais capturées d'un serveur).

export const CHARGE_IDS = {
  lease: '0193a5e1-0000-7000-8000-000000000001',
  leaseLoire: '0193a5e1-0000-7000-8000-000000000002',
  statement: '0193a5e3-0000-7000-8000-000000000001',
  rectified: '0193a5e3-0000-7000-8000-000000000002',
  older: '0193a5e3-0000-7000-8000-000000000003',
  file: '0193a5e4-0000-7000-8000-000000000001',
  secondFile: '0193a5e4-0000-7000-8000-000000000002',
} as const;

const eur = (amount: number) => ({ amount, currency: 'EUR' });
const xof = (amount: number) => ({ amount, currency: 'XOF' });

export const CURSOR_PAGE_2 = 'eyJpZCI6IjAxOTNhNWUzLTAwMDAtNzAwMC04MDAwLTAwMDAwMDAwMDAwMSIsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0';

export function chargeStatement(overrides: Record<string, unknown> = {}) {
  return {
    id: CHARGE_IDS.statement,
    lease_id: CHARGE_IDS.lease,
    number: 'DC-2025-0001',
    status: 'issued',
    period: { start: '2025-01-01', end: '2026-01-01' },
    occupied_days: 365,
    share_total: eur(93800),
    provisions_called: eur(96000),
    balance: eur(-2200),
    suggested_monthly_provision: eur(7817),
    settlement: 'credit',
    not_before: null,
    issued_at: '2026-03-12T09:30:00+00:00',
    files: [],
    ...overrides,
  };
}

export const chargeFile = { id: CHARGE_IDS.file, label: 'Eau et chauffage 2025', visible_until: '2026-09-12' };
export const chargeSecondFile = { id: CHARGE_IDS.secondFile, label: 'Facture ascenseur', visible_until: null };

export const chargeLines = [
  { label: 'Eau froide', split_label: 'Consommation', item_amount: eur(28600), days: 365, share: eur(28600) },
  { label: 'Chauffage collectif', split_label: 'Tantièmes 64/1 000', item_amount: eur(628907), days: 365, share: eur(40250) },
  { label: 'Ordures ménagères', split_label: 'Surface 64,2 m²', item_amount: eur(150000), days: 365, share: eur(9630) },
  { label: 'Entretien des parties communes', split_label: 'Tantièmes 64/1 000', item_amount: eur(184700), days: 365, share: eur(11820) },
  { label: 'Ascenseur', split_label: 'Tantièmes 64/1 000', item_amount: eur(54700), days: 365, share: eur(3500) },
];

export const chargePage = (items: unknown[], nextCursor: string | null = null) => ({ data: items, next_cursor: nextCursor });

export const chargeDetail = (overrides: Record<string, unknown> = {}) => ({ data: { ...chargeStatement(overrides), lines: chargeLines } });

export const chargeToPay = chargeStatement({
  id: CHARGE_IDS.older,
  number: 'DC-2024-0003',
  period: { start: '2024-01-01', end: '2025-01-01' },
  share_total: eur(110500),
  provisions_called: eur(96000),
  balance: eur(14500),
  settlement: 'next_installments',
  not_before: '2025-04-12',
  issued_at: '2025-03-12T08:00:00+00:00',
});

export const chargeSuperseded = chargeStatement({ id: CHARGE_IDS.rectified, number: 'DC-2025-0002', status: 'superseded' });

export const chargeXof = chargeStatement({
  share_total: xof(450000),
  provisions_called: xof(400000),
  balance: xof(50000),
  suggested_monthly_provision: xof(37500),
  settlement: 'plan_12',
});

export const chargeXofDetail = {
  data: {
    ...chargeXof,
    lines: [{ label: 'Eau', split_label: 'Consommation', item_amount: xof(450000), days: 365, share: xof(450000) }],
  },
};

export const chargeNotFoundProblem = {
  type: 'https://api.eguardimmo.test/problems/charge_statement_not_found',
  title: 'Décompte introuvable',
  status: 404,
  code: 'charge_statement_not_found',
  detail: 'Décompte introuvable',
};

export const chargeFileNotFoundProblem = {
  type: 'https://api.eguardimmo.test/problems/charges_file_not_found',
  title: 'Pièce introuvable',
  status: 404,
  code: 'charges_file_not_found',
  detail: 'Pièce introuvable',
};

export const chargePdfUnavailableProblem = {
  type: 'https://api.eguardimmo.test/problems/charges_pdf_unavailable',
  title: 'PDF indisponible',
  status: 503,
  code: 'charges_pdf_unavailable',
  detail: 'PDF indisponible',
};
