import { ApiError, ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import {
  BALANCE_LABEL,
  CHARGE_WORDING,
  balanceDirection,
  exerciseLabel,
  fileExtension,
  lastDayOf,
  settlementText,
} from './chargeLabels';
import {
  CHARGES_PATH,
  chargeFilePath,
  chargePdfPath,
  fetchChargeFile,
  fetchChargePdf,
  fetchChargeStatement,
  fetchChargeStatementsPage,
} from './chargeRequests';
import {
  CHARGE_IDS,
  CURSOR_PAGE_2,
  chargeDetail,
  chargeFile,
  chargeNotFoundProblem,
  chargePage,
  chargePdfUnavailableProblem,
  chargeStatement,
  chargeSuperseded,
  chargeToPay,
  chargeXofDetail,
} from './chargeResponses.fixtures';
import { UnexpectedResponseError, describeFailure } from './errors';

interface Seen {
  url: URL;
  init: RequestInit | undefined;
}

function clientFor(reply: () => Response) {
  const seen: Seen[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    seen.push({ url: new URL(input instanceof Request ? input.url : String(input)), init });
    return Promise.resolve(reply());
  });
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchImpl, readCookie: () => 'xsrf' }), seen, fetchImpl };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const file = (type: string, body = 'contenu') => () => new Response(body, { status: 200, headers: { 'Content-Type': type } });

describe('liste des décomptes de charges', () => {
  it('lit la liste réelle, mappe les champs et prend le curseur à la racine', async () => {
    const { client, seen } = clientFor(json(chargePage([chargeStatement({ files: [chargeFile] }), chargeToPay], CURSOR_PAGE_2)));

    const page = await fetchChargeStatementsPage(client, null, null);

    expect(seen[0]?.url.pathname).toBe(CHARGES_PATH);
    expect(seen[0]?.url.search).toBe('');
    expect(page.nextCursor).toBe(CURSOR_PAGE_2);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({
      id: CHARGE_IDS.statement,
      leaseId: CHARGE_IDS.lease,
      number: 'DC-2025-0001',
      status: 'issued',
      periodStart: '2025-01-01',
      periodEnd: '2026-01-01',
      occupiedDays: 365,
      shareTotal: { amount: 93800, currency: 'EUR' },
      provisionsCalled: { amount: 96000, currency: 'EUR' },
      balance: { amount: -2200, currency: 'EUR' },
      suggestedMonthlyProvision: { amount: 7817, currency: 'EUR' },
      settlement: 'credit',
      notBefore: null,
      issuedAt: '2026-03-12T09:30:00+00:00',
      files: [{ id: CHARGE_IDS.file, label: 'Eau et chauffage 2025', visibleUntil: '2026-09-12' }],
      lines: null,
    });
    expect(page.items[1]?.notBefore).toBe('2025-04-12');
  });

  it('transmet le bail et le curseur, et seulement eux', async () => {
    const { client, seen } = clientFor(json(chargePage([])));

    await fetchChargeStatementsPage(client, CHARGE_IDS.lease, CURSOR_PAGE_2);

    expect(Object.fromEntries(seen[0]?.url.searchParams ?? [])).toEqual({ lease: CHARGE_IDS.lease, cursor: CURSOR_PAGE_2 });
  });

  it('refuse un curseur rangé dans meta, forme des listes de loyers', async () => {
    const { client } = clientFor(json({ data: [chargeStatement()], meta: { next_cursor: null } }));

    await expect(fetchChargeStatementsPage(client, null, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each([
    ['un montant décimal', { share_total: { amount: 938.5, currency: 'EUR' } }],
    ['un montant en texte', { balance: { amount: '14500', currency: 'EUR' } }],
    ['un statut non visible', { status: 'computed' }],
    ['un mode de règlement inconnu', { settlement: 'cash' }],
    ['un identifiant qui n’est pas un UUID', { id: 'DC-1' }],
  ])('refuse %s au lieu d’afficher un faux décompte', async (_name, override) => {
    const { client } = clientFor(json(chargePage([chargeStatement(override)])));

    await expect(fetchChargeStatementsPage(client, null, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('accepte un décompte sans mode de règlement ni période', async () => {
    const { client } = clientFor(json(chargePage([chargeStatement({ settlement: null, period: { start: null, end: null }, issued_at: null })])));

    const page = await fetchChargeStatementsPage(client, null, null);

    expect(page.items[0]).toMatchObject({ settlement: null, periodStart: null, periodEnd: null, issuedAt: null });
  });

  it('lit un décompte remplacé comme tel', async () => {
    const { client } = clientFor(json(chargePage([chargeSuperseded])));

    expect((await fetchChargeStatementsPage(client, null, null)).items[0]?.status).toBe('superseded');
  });
});

describe('détail d’un décompte de charges', () => {
  it('lit les lignes avec la base, les jours et la part', async () => {
    const { client, seen } = clientFor(json(chargeDetail({ files: [chargeFile] })));

    const detail = await fetchChargeStatement(client, CHARGE_IDS.statement);

    expect(seen[0]?.url.pathname).toBe(`${CHARGES_PATH}/${CHARGE_IDS.statement}`);
    expect(detail.lines).toHaveLength(5);
    expect(detail.lines?.[1]).toEqual({
      label: 'Chauffage collectif',
      splitLabel: 'Tantièmes 64/1 000',
      itemAmount: { amount: 628907, currency: 'EUR' },
      days: 365,
      share: { amount: 40250, currency: 'EUR' },
    });
    expect(detail.lines?.reduce((total, line) => total + line.share.amount, 0)).toBe(detail.shareTotal.amount);
  });

  it('refuse un détail sans lignes', async () => {
    const { client } = clientFor(json({ data: chargeStatement() }));

    await expect(fetchChargeStatement(client, CHARGE_IDS.statement)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('conserve la devise XOF et ses montants entiers', async () => {
    const { client } = clientFor(json(chargeXofDetail));

    const detail = await fetchChargeStatement(client, CHARGE_IDS.statement);

    expect(detail.balance).toEqual({ amount: 50000, currency: 'XOF' });
    expect(detail.lines?.[0]?.share).toEqual({ amount: 450000, currency: 'XOF' });
  });

  it('encode l’identifiant dans le chemin', async () => {
    const { client, seen } = clientFor(json(chargeDetail()));

    await fetchChargeStatement(client, 'a/b?c');

    expect(seen[0]?.url.pathname).toBe(`${CHARGES_PATH}/a%2Fb%3Fc`);
  });
});

describe('téléchargements du décompte', () => {
  it('construit les chemins du PDF et des pièces', () => {
    expect(chargePdfPath(CHARGE_IDS.statement)).toBe(`${CHARGES_PATH}/${CHARGE_IDS.statement}/pdf`);
    expect(chargeFilePath(CHARGE_IDS.statement, CHARGE_IDS.file)).toBe(`${CHARGES_PATH}/${CHARGE_IDS.statement}/files/${CHARGE_IDS.file}`);
  });

  it('lit le PDF par le client authentifié', async () => {
    const { client, seen, fetchImpl } = clientFor(file('application/pdf', '%PDF-1.4'));

    const blob = await fetchChargePdf(client, chargePdfPath(CHARGE_IDS.statement), fetchImpl);

    expect(blob.type).toBe('application/pdf');
    expect(seen[0]?.init?.credentials).toBe('include');
    expect(new Headers(seen[0]?.init?.headers).get('Accept')).toBe('application/pdf');
  });

  it('refuse un PDF servi sous un autre type', async () => {
    const { client, fetchImpl } = clientFor(file('text/html', '<html>'));

    await expect(fetchChargePdf(client, chargePdfPath(CHARGE_IDS.statement), fetchImpl)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png'])('accepte une pièce %s', async (type) => {
    const { client, seen, fetchImpl } = clientFor(file(type));

    const blob = await fetchChargeFile(client, chargeFilePath(CHARGE_IDS.statement, CHARGE_IDS.file), fetchImpl);

    expect(blob.type).toBe(type);
    expect(new Headers(seen[0]?.init?.headers).get('Accept')).toBe('application/pdf, image/jpeg, image/png');
  });

  it.each(['text/html', 'application/json', 'image/svg+xml'])('refuse une pièce %s, qui pourrait exécuter du script', async (type) => {
    const { client, fetchImpl } = clientFor(file(type));

    await expect(fetchChargeFile(client, chargeFilePath(CHARGE_IDS.statement, CHARGE_IDS.file), fetchImpl)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('traduit un réseau coupé', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('réseau')));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    await expect(fetchChargePdf(client, chargePdfPath(CHARGE_IDS.statement), fetchImpl)).rejects.toBeInstanceOf(ApiUnreachableError);
  });
});

describe('erreurs du décompte de charges', () => {
  async function failureOf(reply: () => Response, run: (client: ReturnType<typeof clientFor>['client'], fetchImpl: typeof fetch) => Promise<unknown>) {
    const { client, fetchImpl } = clientFor(reply);
    return describeFailure(await run(client, fetchImpl).catch((error: unknown) => error), CHARGE_WORDING);
  }

  it('traduit 404 charge_statement_not_found', async () => {
    const failure = await failureOf(json(chargeNotFoundProblem, 404), (client) => fetchChargeStatement(client, CHARGE_IDS.statement));

    expect(failure).toEqual({ kind: 'notFound', message: 'Ce décompte n’existe pas ou n’est plus accessible depuis votre espace.' });
  });

  it('traduit 404 charges_file_not_found par une invitation à écrire à l’agence', async () => {
    const problem = { ...chargeNotFoundProblem, code: 'charges_file_not_found' };
    const failure = await failureOf(json(problem, 404), (client, fetchImpl) => fetchChargeFile(client, chargeFilePath(CHARGE_IDS.statement, CHARGE_IDS.file), fetchImpl));

    expect(failure.kind).toBe('notFound');
    expect(failure.message).toContain('par message');
  });

  it('traduit 429 avec l’attente annoncée', async () => {
    const failure = await failureOf(
      json({ ...chargeNotFoundProblem, status: 429, code: 'http_429' }, 429, { 'Retry-After': '20' }),
      (client) => fetchChargeStatementsPage(client, null, null),
    );

    expect(failure.kind).toBe('rateLimited');
    expect(failure.message).toContain('20 s');
  });

  it('traduit 503 charges_pdf_unavailable', async () => {
    const failure = await failureOf(json(chargePdfUnavailableProblem, 503, { 'Retry-After': '30' }), (client, fetchImpl) => fetchChargePdf(client, chargePdfPath(CHARGE_IDS.statement), fetchImpl));

    expect(failure.message).toBe(CHARGE_WORDING.codes.charges_pdf_unavailable);
  });

  it('traduit 503 sans code connu par le message du service indisponible', async () => {
    const failure = await failureOf(json({ ...chargePdfUnavailableProblem, code: 'service_unavailable' }, 503), (client) => fetchChargeStatementsPage(client, null, null));

    expect(failure.message).toBe(CHARGE_WORDING.unavailable);
  });

  it('garde ApiError pour les statuts inattendus', async () => {
    const { client } = clientFor(json({ ...chargeNotFoundProblem, status: 500, code: 'server_error' }, 500));

    await expect(fetchChargeStatementsPage(client, null, null)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('libellés du décompte', () => {
  it('lit le signe du solde : positif à payer, négatif à rendre', () => {
    expect(balanceDirection({ amount: 14500, currency: 'EUR' })).toBe('pay');
    expect(balanceDirection({ amount: -2200, currency: 'EUR' })).toBe('refund');
    expect(balanceDirection({ amount: 0, currency: 'EUR' })).toBe('none');
    expect(BALANCE_LABEL.pay).toBe('Solde à payer');
    expect(BALANCE_LABEL.refund).toBe('Solde à vous rendre');
  });

  it('traite la fin de période du serveur comme exclue', () => {
    expect(lastDayOf('2026-01-01')).toBe('2025-12-31');
    expect(exerciseLabel('2025-01-01', '2026-01-01')).toBe('2025');
    expect(exerciseLabel('2025-04-01', '2026-04-01')).toBe('du 01/04/2025 au 31/03/2026');
    expect(exerciseLabel('2025-03-01', '2025-12-01')).toBe('du 01/03/2025 au 30/11/2025');
    expect(exerciseLabel(null, '2026-01-01')).toBeNull();
  });

  it('explique chaque mode de règlement en français', () => {
    expect(settlementText('next_installments', '2026-04-12')).toBe('Le solde sera ajouté à vos prochains avis d’échéance à partir du 12/04/2026.');
    expect(settlementText('next_installments', null)).toBe('Le solde sera ajouté à vos prochains avis d’échéance.');
    expect(settlementText('plan_12', null)).toContain('étalé sur 12 mois');
    expect(settlementText('standalone_installment', null)).toContain('avis d’échéance distinct');
    expect(settlementText('credit', null)).toBe('Le crédit sera repris à votre prochain avis d’échéance.');
    expect(settlementText('none', null)).toContain('Aucun règlement');
  });

  it('choisit l’extension d’après le type reçu', () => {
    expect(fileExtension('application/pdf')).toBe('pdf');
    expect(fileExtension('image/jpeg')).toBe('jpg');
    expect(fileExtension('image/png; charset=binary')).toBe('png');
    expect(fileExtension('')).toBe('pdf');
  });
});
