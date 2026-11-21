import { IDS } from './responses.fixtures';

const REQUEST_A = '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0a1';
const REQUEST_B = '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0a2';
const FILE = '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b1';
const BANK = '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0c1';

export const REQUEST_IDS = { a: REQUEST_A, b: REQUEST_B, file: FILE, bank: BANK };

export const payoutRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQUEST_A,
  mandant_party_id: IDS.mandantA,
  status: 'pending',
  bank_account_id: BANK,
  bank_last4: '7890',
  holder_name: 'Awa Diallo',
  proof_file_id: FILE,
  requested_by_user_id: IDS.user,
  decided_by_user_id: null,
  decided_at: null,
  reject_reason: null,
  lock_version: 4,
  created_at: '2026-11-16T08:30:00+00:00',
  ...overrides,
});

const links = { first: null, last: null, prev: null, next: null };
const meta = (nextCursor: string | null = null) => ({ path: 'https://api.test/api/v1/x', per_page: 25, next_cursor: nextCursor, prev_cursor: null });

export const requestsPending = { data: [payoutRequest(), payoutRequest({ id: REQUEST_B, mandant_party_id: IDS.mandantB, bank_last4: '4321', holder_name: 'SCI Les Tilleuls', lock_version: 2, created_at: '2026-11-15T10:00:00+00:00' })], links, meta: meta() };
export const requestsEmpty = { data: [], links, meta: meta() };
export const requestsNext = { ...requestsPending, meta: meta('curseur-2') };
export const requestsRejected = {
  data: [payoutRequest({ status: 'rejected', decided_by_user_id: IDS.user, decided_at: '2026-11-16T09:00:00+00:00', reject_reason: 'Titulaire de la pièce différent du mandant', lock_version: 5 })],
  links,
  meta: meta(),
};
export const requestsAwaitingCode = { data: [payoutRequest({ status: 'awaiting_code', lock_version: 1 })], links, meta: meta() };
export const requestApproved = { data: payoutRequest({ status: 'approved', decided_by_user_id: IDS.user, decided_at: '2026-11-16T10:00:00+00:00', lock_version: 5 }) };
export const requestRejected = { data: payoutRequest({ status: 'rejected', decided_by_user_id: IDS.user, decided_at: '2026-11-16T10:00:00+00:00', reject_reason: 'Pièce illisible', lock_version: 5 }) };

const problem = (status: number, code: string, title: string, detail: string) => ({ type: `https://api.test/problems/${code}`, title, status, detail, code });
export const requestProblems = {
  reauth: problem(403, 'reauthentication_required', 'Confirmation récente requise', 'Confirmez votre identité avec un code de double authentification.'),
  twoFactor: problem(403, 'two_factor_required', 'Double authentification requise', 'Activez la double authentification.'),
  role: problem(403, 'role_forbidden', 'Rôle insuffisant', 'Votre rôle ne permet pas cette action.'),
  notFound: problem(404, 'payout_account_request_not_found', 'Demande introuvable', 'Cette demande n’existe pas.'),
  notActionable: problem(409, 'payout_account_request_not_actionable', 'Action impossible', 'L’état de cette demande ne permet pas cette action.'),
  stale: problem(409, 'payout_account_request_stale', 'Demande modifiée', 'Cette demande a changé depuis votre lecture.'),
  selfApproval: problem(409, 'payout_account_self_approval', 'Validation par le demandeur interdite', 'x'),
  contested: problem(409, 'payout_account_contested', 'Changement contesté', 'x'),
  accessRevoked: problem(409, 'payout_account_access_revoked', 'Accès révoqué', 'x'),
  ibanMismatch: problem(422, 'payout_account_iban_mismatch', 'IBAN différent de la demande', 'L’IBAN saisi ne correspond pas à celui de la demande.'),
  holderMismatch: problem(422, 'payout_account_holder_mismatch', 'Titulaire différent de la demande', 'x'),
  validation: { ...problem(422, 'validation_failed', 'Validation échouée', 'Les données sont invalides.'), errors: { holder_name: ['Le titulaire est obligatoire.'] } },
};
