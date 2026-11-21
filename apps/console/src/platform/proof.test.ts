import { describe, expect, it, vi } from 'vitest';
import { problem, proofInvalid, proofRequired } from './fixtures';
import { createProofBroker, createProofFetch } from './proof';
import type { OperatorProof, ProofBroker } from './proof';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = () => json(200, { data: { done: true } });
const URL_WRITE = '/api/v1/console/accounts/1/session-revocation';

function answering(broker: ProofBroker, ...proofs: (OperatorProof | null)[]) {
  const asked: boolean[] = [];
  const queue = [...proofs];
  const timer = setInterval(() => {
    const current = broker.current();
    if (current === null) return;
    asked.push(current.rejected);
    broker.answer(current.id, queue.shift() ?? null);
  }, 0);
  return { asked, stop: () => { clearInterval(timer); } };
}

function setup(...responses: Response[]) {
  const queue = [...responses];
  const base = vi.fn<typeof fetch>(() => Promise.resolve(queue.shift() ?? json(500, { code: 'unexpected' })));
  const broker = createProofBroker();
  return { base, broker, fetchImpl: createProofFetch(base, broker) };
}

const bodyOf = (base: ReturnType<typeof setup>['base'], index: number): unknown => {
  const raw = base.mock.calls[index]?.[1]?.body;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

describe('rejeu des écritures avec la preuve 2FA', () => {
  it('rejoue une écriture sans corps avec le code, sans jamais le conserver', async () => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired), ok());
    const answers = answering(broker, { kind: 'totp', code: '123456' });

    const response = await fetchImpl(URL_WRITE, { method: 'POST', headers: { Accept: 'application/json' } });
    answers.stop();

    expect(response.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    expect(base.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(bodyOf(base, 1)).toEqual({ two_factor_code: '123456' });
    expect(base.mock.calls.map((call) => call[0])).toEqual([URL_WRITE, URL_WRITE]);
    expect(new Headers(base.mock.calls[1]?.[1]?.headers).get('content-type')).toBe('application/json');
    expect(broker.current()).toBeNull();
  });

  it('ajoute le code de secours au corps JSON existant et remplace un ancien code', async () => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired), ok());
    const answers = answering(broker, { kind: 'recovery', code: 'abcde-fghij' });

    await fetchImpl(URL_WRITE, { method: 'POST', body: JSON.stringify({ reason: 'fraud', two_factor_code: '000000' }), headers: { 'Content-Type': 'application/json' } });
    answers.stop();

    expect(bodyOf(base, 1)).toEqual({ reason: 'fraud', recovery_code: 'abcde-fghij' });
  });

  it('rejoue un corps multipart avec le code', async () => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired), ok());
    const answers = answering(broker, { kind: 'totp', code: '654321' });
    const form = new FormData();
    form.append('body', 'Bonjour');

    await fetchImpl('/api/v1/console/support/tickets/1/messages', { method: 'POST', body: form });
    answers.stop();

    const replayed = bodyOf(base, 1);
    expect(replayed).toBeInstanceOf(FormData);
    expect((replayed as FormData).get('body')).toBe('Bonjour');
    expect((replayed as FormData).get('two_factor_code')).toBe('654321');
  });

  it.each([
    ['URLSearchParams', () => new URLSearchParams({ reason: 'fraud' })],
    ['Blob', () => new Blob(['{"reason":"fraud"}'])],
  ])('refuse explicitement de rejouer un corps %s au lieu de le remplacer par le seul code', async (_name, makeBody) => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired), ok());
    const answers = answering(broker, { kind: 'totp', code: '654321' });

    await expect(fetchImpl(URL_WRITE, { method: 'POST', body: makeBody() })).rejects.toThrow(/non rejouable/);
    answers.stop();

    expect(base).toHaveBeenCalledTimes(1);
  });

  it('redemande un code en signalant le refus quand le serveur le juge invalide', async () => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired), json(422, proofInvalid), ok());
    const answers = answering(broker, { kind: 'totp', code: '111111' }, { kind: 'totp', code: '222222' });

    const response = await fetchImpl(URL_WRITE, { method: 'POST' });
    answers.stop();

    expect(response.status).toBe(200);
    expect(answers.asked).toEqual([false, true]);
    expect(bodyOf(base, 2)).toEqual({ two_factor_code: '222222' });
  });

  it('rend la réponse 422 d’origine quand l’opérateur annule, sans second envoi', async () => {
    const { base, broker, fetchImpl } = setup(json(422, proofRequired));
    const answers = answering(broker, null);

    const response = await fetchImpl(URL_WRITE, { method: 'POST' });
    answers.stop();

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'operator_proof_required' });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('ne touche ni aux lectures, ni aux autres 422, ni aux routes hors console', async () => {
    const get = setup(json(422, proofRequired));
    expect((await get.fetchImpl('/api/v1/console/accounts', { method: 'GET' })).status).toBe(422);
    expect(get.base).toHaveBeenCalledTimes(1);
    expect(get.broker.current()).toBeNull();

    const validation = setup(json(422, problem(422, 'validation_failed', 'Invalide')));
    expect((await validation.fetchImpl(URL_WRITE, { method: 'POST' })).status).toBe(422);
    expect(validation.base).toHaveBeenCalledTimes(1);

    const elsewhere = setup(json(422, proofRequired));
    expect((await elsewhere.fetchImpl('/api/v1/org/1/leases', { method: 'POST' })).status).toBe(422);
    expect(elsewhere.broker.current()).toBeNull();
  });

  it('laisse passer sans demande une écriture acceptée du premier coup', async () => {
    const { base, fetchImpl } = setup(ok());

    expect((await fetchImpl(URL_WRITE, { method: 'POST' })).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe('courtier de preuve', () => {
  it('sert les demandes une à une, dans l’ordre', async () => {
    const broker = createProofBroker();
    const first = broker.request(false);
    const second = broker.request(true);

    expect(broker.current()).toMatchObject({ rejected: false });
    broker.answer(broker.current()?.id ?? 0, { kind: 'totp', code: '123456' });
    expect(await first).toEqual({ kind: 'totp', code: '123456' });
    expect(broker.current()).toMatchObject({ rejected: true });
    broker.answer(broker.current()?.id ?? 0, null);
    expect(await second).toBeNull();
    expect(broker.current()).toBeNull();
  });

  it('ignore une réponse portant un identifiant périmé et prévient les abonnés', () => {
    const broker = createProofBroker();
    const listener = vi.fn();
    const stop = broker.subscribe(listener);
    void broker.request(false);
    expect(listener).toHaveBeenCalledTimes(1);

    broker.answer(999, { kind: 'totp', code: '123456' });
    expect(broker.current()).not.toBeNull();

    stop();
    broker.answer(broker.current()?.id ?? 0, null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
