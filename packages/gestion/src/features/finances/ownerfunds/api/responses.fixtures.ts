export const IDS = {
  org: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab001',
  mandantA: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab002',
  mandantB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab003',
  batchDraft: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab010',
  batchValidated: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab011',
  itemA: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab020',
  itemB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab021',
  hold: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab030',
  holdB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab031',
  fee: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab040',
  feeB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab043',
  mandate: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab041',
  invoice: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab042',
  deposit: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab050',
  depositB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab051',
  period: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab060',
  user: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab070',
  account: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab080',
};

export const eur = (amount: number) => ({ amount, currency: 'EUR' });

const evaluation = (overrides: Record<string, unknown>) => ({
  mandant_party_id: IDS.mandantA,
  payable: eur(120000),
  in_transit: eur(0),
  called_not_collected: eur(45000),
  fees_due: eur(9600),
  fees_estimated: eur(3600),
  reserve: eur(0),
  full_hold: false,
  net_payable: eur(106800),
  bank_last4: '4321',
  exclusion_reason: null,
  ...overrides,
});

export const evaluationA = evaluation({});
export const evaluationB = evaluation({ mandant_party_id: IDS.mandantB, payable: eur(80000), fees_due: eur(6400), fees_estimated: eur(0), net_payable: eur(73600), bank_last4: null, exclusion_reason: 'no_payout_account' });

export const preview = { data: [evaluationA, evaluationB], meta: { limit: 20, truncated: false } };
export const previewTruncated = { data: [evaluationA], meta: { limit: 1, truncated: true } };
export const account = { data: evaluationA };

export const party = (id: string, name: string) => ({
  data: { id, kind: 'person', display_name: name, last_name: null, first_name: null, company_name: null, is_anonymized: false, archived_at: null },
});
export const partyA = party(IDS.mandantA, 'Awa Diallo');
export const partyB = party(IDS.mandantB, 'SCI Les Tilleuls');

const item = (overrides: Record<string, unknown>) => ({
  id: IDS.itemA,
  batch_id: IDS.batchDraft,
  mandant_party_id: IDS.mandantA,
  status: 'included',
  exclusion_reason: null,
  net_amount: eur(106800),
  fees_settled_amount: eur(9600),
  bank_account_id: IDS.account,
  bank_last4: '4321',
  executed_on: null,
  bank_reference: null,
  executed_solo: false,
  failure_reason: null,
  lock_version: 1,
  ...overrides,
});

const batch = (overrides: Record<string, unknown>) => ({
  id: IDS.batchDraft,
  number: null,
  status: 'draft',
  currency: 'EUR',
  lock_version: 3,
  second_approver_required: false,
  validated_at: null,
  cancelled_at: null,
  cancel_reason: null,
  created_at: '2026-11-16T09:00:00+00:00',
  ...overrides,
});

export const itemIncluded = item({});
export const itemExcludedNoAccount = item({ id: IDS.itemB, mandant_party_id: IDS.mandantB, status: 'excluded', exclusion_reason: 'no_payout_account', net_amount: eur(73600), fees_settled_amount: eur(0), bank_last4: null, bank_account_id: null });
export const itemExcludedManual = item({ id: IDS.itemB, mandant_party_id: IDS.mandantB, status: 'excluded', exclusion_reason: 'manual', net_amount: eur(73600), fees_settled_amount: eur(0) });
export const itemPending = item({ batch_id: IDS.batchValidated, status: 'pending' });
export const itemPaid = item({ batch_id: IDS.batchValidated, status: 'paid', executed_on: '2026-11-17', bank_reference: 'VIR-20261117-01', lock_version: 2 });

export const batchDraft = { data: batch({ items: [itemIncluded, itemExcludedNoAccount] }) };
export const batchDraftManualExclusion = { data: batch({ items: [itemIncluded, itemExcludedManual] }) };
export const batchValidated = { data: batch({ id: IDS.batchValidated, number: 'RV-2026-0001', status: 'validated', lock_version: 4, second_approver_required: true, validated_at: '2026-11-16T10:00:00+00:00', items: [itemPending] }) };
export const batchValidatedSolo = { data: batch({ id: IDS.batchValidated, number: 'RV-2026-0001', status: 'validated', lock_version: 4, second_approver_required: false, validated_at: '2026-11-16T10:00:00+00:00', items: [itemPending] }) };
export const batchExecuted = { data: batch({ id: IDS.batchValidated, number: 'RV-2026-0001', status: 'executed', lock_version: 5, second_approver_required: true, validated_at: '2026-11-16T10:00:00+00:00', items: [itemPaid] }) };
export const batchValidatedWithExclusion = { data: batch({ id: IDS.batchDraft, number: 'RV-2026-0002', status: 'validated', lock_version: 4, validated_at: '2026-11-16T10:00:00+00:00', items: [itemPending, itemExcludedNoAccount] }) };
export const batchCancelled = { data: batch({ status: 'cancelled', cancelled_at: '2026-11-16T11:00:00+00:00', cancel_reason: 'Erreur de sélection', items: [] }) };

const cursorMeta = (nextCursor: string | null = null) => ({ path: 'https://api.test/api/v1/x', per_page: 25, next_cursor: nextCursor, prev_cursor: null });
const links = { first: null, last: null, prev: null, next: null };

export const batchesPage = { data: [batch({}), batch({ id: IDS.batchValidated, number: 'RV-2026-0001', status: 'validated', second_approver_required: true, validated_at: '2026-11-16T10:00:00+00:00' })], links, meta: cursorMeta() };
export const batchesPageNext = { ...batchesPage, meta: cursorMeta('curseur-2') };
export const batchesEmpty = { data: [], links, meta: cursorMeta() };

export const hold = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.hold,
  mandant_party_id: IDS.mandantA,
  kind: 'reserve',
  amount: eur(20000),
  reason: 'works_reserve',
  comment: 'Toiture à refaire',
  placed_by_user_id: IDS.user,
  released_at: null,
  created_at: '2026-11-10T08:00:00+00:00',
  ...overrides,
});
export const holdsPage = { data: [hold(), hold({ id: IDS.holdB, mandant_party_id: IDS.mandantB, kind: 'full', amount: null, reason: 'dispute', comment: null })], links, meta: cursorMeta() };
export const holdsEmpty = { data: [], links, meta: cursorMeta() };
export const holdCreated = { data: hold({ kind: 'full', amount: null, reason: 'dispute', comment: null }) };
export const holdReleased = { data: hold({ released_at: '2026-11-16T12:00:00+00:00' }) };

export const fee = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.fee,
  mandate_id: IDS.mandate,
  mandant_party_id: IDS.mandantA,
  month: '2026-10',
  base_rent: eur(120000),
  base_charges: eur(12000),
  fee_kind: 'percentage',
  rate_bp: 800,
  minimum_applied: false,
  fee_net: eur(9600),
  tax_amount: eur(1920),
  fee_total: eur(11520),
  carried_net: eur(0),
  invoice_id: IDS.invoice,
  credit_note_id: null,
  ...overrides,
});
export const feesPage = { data: [fee(), fee({ id: IDS.feeB, mandant_party_id: IDS.mandantB, fee_kind: 'flat', rate_bp: null, minimum_applied: true, fee_net: eur(5000), tax_amount: eur(1000), fee_total: eur(6000), carried_net: eur(1500), invoice_id: null })], links, meta: cursorMeta() };
export const feesEmpty = { data: [], links, meta: cursorMeta() };

export const coverage = {
  data: {
    trust_bank: eur(900000),
    owner_payable: eur(500000),
    payouts_in_transit: eur(100000),
    security_deposits: eur(150000),
    tenant_advances: eur(10000),
    required: eur(760000),
    surplus: eur(140000),
    covered: true,
  },
};
export const coverageGap = { data: { ...coverage.data, trust_bank: eur(600000), required: eur(760000), surplus: eur(0), covered: false } };

export const deposit = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.deposit,
  status: 'pending',
  amount: eur(160000),
  executed_on: '2026-11-15',
  bank_reference: 'VIR-20261115-07',
  second_approver_required: true,
  requested_by_user_id: IDS.user,
  confirmed_by_user_id: null,
  confirmed_at: null,
  confirmed_solo: false,
  trust_transfer_id: null,
  created_at: '2026-11-15T16:00:00+00:00',
  ...overrides,
});
export const depositsPage = { data: [deposit(), deposit({ id: IDS.depositB, status: 'confirmed', second_approver_required: false, confirmed_solo: true, confirmed_at: '2026-11-12T09:00:00+00:00', confirmed_by_user_id: IDS.user, trust_transfer_id: IDS.account })], links, meta: cursorMeta() };
export const depositsEmpty = { data: [], links, meta: cursorMeta() };
export const depositCreated = { data: deposit() };
export const depositConfirmed = { data: deposit({ status: 'confirmed', confirmed_at: '2026-11-16T10:00:00+00:00', confirmed_by_user_id: IDS.user, trust_transfer_id: IDS.account }) };
export const transferCreated = { data: { id: IDS.account, direction: 'withdraw_fees', amount: eur(50000), executed_on: '2026-11-16', bank_reference: 'VIR-1', ledger_entry_id: IDS.period } };

const period = (id: string, month: string, start: string, end: string) => ({
  id,
  month,
  period_start: start,
  period_end_exclusive: end,
  closed_at: '2026-11-02T08:00:00+00:00',
  closed_by_user_id: IDS.user,
  closing_cutoff: { version: 'v1' },
});
export const periods = { data: [period(IDS.period, '2026-09', '2026-09-01', '2026-10-01'), period(IDS.account, '2026-10', '2026-10-01', '2026-11-01')] };
export const periodsEmpty = { data: [] };
export const closed = { data: period(IDS.deposit, '2026-11', '2026-11-01', '2026-12-01'), warnings: [] as string[] };
export const closedWithWarning = { ...closed, warnings: ['pending_payouts_older_than_threshold'] };

const problem = (status: number, code: string, title: string, detail: string) => ({ type: `https://api.test/problems/${code}`, title, status, detail, code });
export const problemStale = problem(409, 'payout_stale_version', 'Lot modifié entre-temps', 'Ce lot a été modifié depuis votre lecture : rechargez-le.');
export const problemTwoFactor = problem(403, 'two_factor_required', 'Double authentification requise', 'Activez la double authentification sur votre compte pour accéder à cette organisation.');
export const problemSecondApprover = problem(403, 'payout_second_approver_required', 'Second validateur requis', 'Le reversement doit être exécuté par une autre personne que celle qui l\'a validé.');
export const problemAccountChanged = problem(409, 'payout_account_changed', 'Compte de paiement modifié', 'Le compte de paiement du mandant a changé depuis la validation du lot.');
export const problemFundsGap = problem(409, 'trust_funds_gap', 'Écart de cantonnement', 'Les fonds du compte de tiers ne couvrent pas ce que l\'agence doit.');
export const problemNotClosable = problem(409, 'accounting_period_not_closable', 'Clôture impossible', 'Motifs : trust_funds_gap, payouts_in_transit_mismatch.');
export const problemNotClosableMonthNotOver = problem(409, 'accounting_period_not_closable', 'Clôture impossible', 'Motifs : month_not_over.');
export const problemPeriodOrder = problem(409, 'accounting_period_order', 'Ordre de clôture', 'Les mois se clôturent dans l\'ordre.');
export const problemKeyReused = problem(409, 'owner_funds_idempotency_key_reused', 'Clé d\'idempotence déjà utilisée', 'Cette clé d\'idempotence a déjà servi pour une demande différente.');
export const problemExceedsSurplus = problem(409, 'trust_withdrawal_exceeds_surplus', 'Prélèvement supérieur à l\'excédent', 'Le prélèvement dépasse l\'excédent du compte de tiers.');
export const problemDepositNotActionable = problem(409, 'trust_deposit_not_actionable', 'Apport déjà confirmé', 'Cet apport a déjà été confirmé.');
export const problemNotValidatable = problem(409, 'payout_not_validatable', 'Lot non validable', 'Seul un lot brouillon comportant au moins un mandant inclus peut être validé.');
export const problemBatchNotFound = problem(404, 'payout_batch_not_found', 'Lot de reversements introuvable', 'Ce lot n\'existe pas dans votre organisation.');
export const problemMandantNotFound = problem(404, 'owner_funds_mandant_not_found', 'Mandant introuvable', 'Ce mandant n\'existe pas dans votre organisation.');
export const problemAgencyOnly = problem(403, 'owner_funds_agency_only', 'Fonction réservée aux agences', 'Les fonds des mandants sont réservés aux organisations de type agence.');
export const problemRole = problem(403, 'role_forbidden', 'Rôle insuffisant', 'Votre rôle ne permet pas cette action.');
export const problemKeyRequired = problem(422, 'owner_funds_idempotency_key_required', 'Clé d\'idempotence requise', 'L\'en-tête Idempotency-Key est obligatoire pour cette action.');
export const problemValidation = { ...problem(422, 'validation_failed', 'Validation échouée', 'Les données sont invalides.'), errors: { reference: ['La référence est invalide.'] } };
export const problemSupplierEngagement = problem(409, 'supplier_payment_engagement_required', 'Engagement requis', 'Un engagement est obligatoire.');
export const problemOwnerInsufficient = problem(409, 'owner_funds_insufficient', 'Solde du mandant insuffisant', 'Le solde du mandant ne couvre pas ce règlement.');
export const problemSupplierSecondApprover = problem(403, 'supplier_payment_second_approver_required', 'Second validateur requis', 'Au-delà du seuil, un second validateur est requis.');
