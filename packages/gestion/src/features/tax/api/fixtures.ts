import { TEST_ORG, TEST_PARTY, TEST_PROPERTY } from '../../orgapi/testing';

export const IDS = {
  org: TEST_ORG,
  property: TEST_PROPERTY,
  mandant: TEST_PARTY,
  mandantTwo: '0198a0a0-0000-7000-8000-0000000000c2',
  summary: '0198e000-0000-7000-8000-000000000001',
  summaryTwo: '0198e000-0000-7000-8000-000000000002',
  statement: '0198e000-0000-7000-8000-000000000011',
} as const;

const eur = (amount: number) => ({ amount, currency: 'EUR' });

const line = (code: string, label: string, rounded: number, status = 'computed', sources: readonly { kind: string; ref: string | null; amount: number }[] = []) => ({
  code,
  label,
  status,
  exact: eur(rounded * 100 + 37),
  rounded: eur(rounded * 100),
  sources: sources.map((source) => ({ kind: source.kind, ref: source.ref, amount: eur(source.amount) })),
  sources_truncated: false,
});

export const income = {
  income_year: 2025,
  form_version: 'fr-2044-2025',
  currency: 'EUR',
  provisional: false,
  household_complete: false,
  properties: [
    {
      property_id: IDS.property,
      name: 'Résidence des Lilas',
      premises: 2,
      co_owners: [{ share_bp: 5000, nature: 'full' }, { share_bp: 5000, nature: 'full' }],
      lines: [
        line('211', 'Loyers bruts encaissés', 12_000, 'computed', [{ kind: 'rent_collected', ref: null, amount: 1_200_000 }]),
        line('221', 'Frais d’administration et de gestion', 900, 'proposed', [{ kind: 'flat_fee', ref: '2', amount: 90_000 }]),
        line('227', 'Intérêts d’emprunt', 4_800, 'to_complete'),
      ],
    },
  ],
  totals: [line('215', 'Total des recettes', 12_000, 'total'), line('263', 'Revenu foncier net', 4_100, 'total')],
  micro: {
    gross_receipts: eur(1_200_000),
    allowance_bp: 3000,
    base_after_allowance: eur(840_000),
    threshold: eur(1_500_000),
    real_base: eur(410_000),
  },
  deficit: null,
  warnings: [{ code: 'shared_ownership', property_id: IDS.property, message: 'Ce bien est détenu à plusieurs : vérifiez les quotes-parts avant de déclarer.' }],
  warning: 'Estimation indicative : elle ne remplace ni le formulaire officiel ni un conseil professionnel.',
  mentions: ['Montants arrondis à l’euro le plus proche.'],
  blockers: [],
} as const;

export const incomeProvisional = { ...income, provisional: true };
export const incomeWithBlocker = { ...income, blockers: [{ code: 'interest_source_conflict', property_id: IDS.property }] };
export const incomeWithDeficit = {
  ...income,
  household_complete: true,
  deficit: { result: eur(-300_000), interest_part: eur(-200_000), other_part: eur(-100_000), imputable_on_global_income: eur(-1_000_000), carried_forward: eur(0) },
};

const summaryBase = {
  id: IDS.summary,
  scope: 'organization',
  mandant_party_id: null,
  income_year: 2025,
  form_version: 'fr-2044-2025',
  status: 'final',
  currency: 'EUR',
  template_version: 'v1',
  supersedes_id: null,
  rectification_reason: null,
  has_pdf: true,
  published_at: null,
  lock_version: 1,
  created_at: '2026-03-10T09:00:00+00:00',
} as const;

const totals = [
  { code: '215', amount: eur(1_200_000) },
  { code: '263', amount: eur(410_000) },
];

export const summaryListRow = { ...summaryBase, totals };
export const summaryDetail = { ...summaryBase, income };
export const summarySuperseded = { ...summaryListRow, id: IDS.summaryTwo, status: 'superseded', rectification_reason: null };
export const statementListRow = { ...summaryListRow, id: IDS.statement, scope: 'mandant', mandant_party_id: IDS.mandant };
export const statementDetail = { ...summaryDetail, id: IDS.statement, scope: 'mandant', mandant_party_id: IDS.mandant };

export const page = (rows: readonly unknown[], next: string | null = null) => ({ data: rows, meta: { next_cursor: next, per_page: 25 } });

export const generation = {
  data: [
    { mandant_id: IDS.mandant, outcome: 'created', statement: statementListRow, error: null },
    { mandant_id: IDS.mandantTwo, outcome: 'failed', statement: null, error: { code: 'tax_period_not_closed', status: 409, detail: 'Une période comptable de l’année n’est pas clôturée.' } },
  ],
};

export const mandants = { data: [{ party_id: IDS.mandant, display_name: 'Entreprise Dubois' }, { party_id: IDS.mandantTwo, display_name: 'Famille Kouassi' }] };
