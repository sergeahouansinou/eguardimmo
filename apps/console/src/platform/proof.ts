export type ProofKind = 'totp' | 'recovery';

export interface OperatorProof {
  kind: ProofKind;
  code: string;
}

export interface ProofRequest {
  id: number;
  rejected: boolean;
}

export interface ProofBroker {
  request: (rejected: boolean) => Promise<OperatorProof | null>;
  answer: (id: number, proof: OperatorProof | null) => void;
  subscribe: (listener: () => void) => () => void;
  current: () => ProofRequest | null;
}

interface Waiting extends ProofRequest {
  resolve: (proof: OperatorProof | null) => void;
}

/** Un seul code est demandé à la fois ; les demandes simultanées attendent leur tour. */
export function createProofBroker(): ProofBroker {
  const queue: Waiting[] = [];
  const listeners = new Set<() => void>();
  let next = 1;
  let snapshot: ProofRequest | null = null;

  const publish = () => {
    const head = queue[0];
    snapshot = head === undefined ? null : { id: head.id, rejected: head.rejected };
    for (const listener of listeners) listener();
  };

  return {
    request: (rejected) =>
      new Promise((resolve) => {
        queue.push({ id: next++, rejected, resolve });
        if (queue.length === 1) publish();
      }),
    answer: (id, proof) => {
      const head = queue[0];
      if (head?.id !== id) return;
      queue.shift();
      head.resolve(proof);
      publish();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    current: () => snapshot,
  };
}

const PROOF_CODES = new Set(['operator_proof_required', 'operator_proof_invalid']);
const CONSOLE_PREFIX = '/api/v1/console/';

function pathOf(input: Parameters<typeof fetch>[0]): string | null {
  if (typeof input === 'string') return new URL(input, 'http://relay.invalid').pathname;
  if (input instanceof URL) return input.pathname;
  return null;
}

async function proofProblem(response: Response): Promise<string | null> {
  if (response.status !== 422) return null;
  const body: unknown = await response.clone().json().catch(() => null);
  const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : null;
  return typeof code === 'string' && PROOF_CODES.has(code) ? code : null;
}

function withProof(init: RequestInit | undefined, proof: OperatorProof): RequestInit {
  const field = proof.kind === 'recovery' ? 'recovery_code' : 'two_factor_code';
  const headers = new Headers(init?.headers);
  const body = init?.body;
  if (body instanceof FormData) {
    const copy = new FormData();
    for (const [key, value] of body.entries()) if (key !== 'two_factor_code' && key !== 'recovery_code') copy.append(key, value);
    copy.append(field, proof.code);
    return { ...init, headers, body: copy };
  }
  if (body !== undefined && body !== null && typeof body !== 'string') {
    throw new TypeError('Corps de requête non rejouable avec la preuve : seuls JSON et FormData sont pris en charge.');
  }
  let payload: Record<string, unknown> = {};
  if (typeof body === 'string' && body !== '') {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) payload = { ...(parsed as Record<string, unknown>) };
  }
  delete payload.two_factor_code;
  delete payload.recovery_code;
  payload[field] = proof.code;
  headers.set('Content-Type', 'application/json');
  return { ...init, headers, body: JSON.stringify(payload) };
}

/**
 * Rejoue une écriture de la console avec la preuve 2FA quand le serveur la réclame. Le code n'est ni conservé ni journalisé :
 * il n'existe que le temps du rejeu.
 */
export function createProofFetch(base: typeof fetch, broker: ProofBroker): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const first = await base(input, init);
    const path = pathOf(input);
    if (method === 'GET' || method === 'HEAD' || !path?.startsWith(CONSOLE_PREFIX)) return first;

    let response = first;
    for (;;) {
      const problem = await proofProblem(response);
      if (problem === null) return response;
      const proof = await broker.request(problem === 'operator_proof_invalid');
      if (proof === null) return response;
      response = await base(input, withProof(init, proof));
    }
  };
}
