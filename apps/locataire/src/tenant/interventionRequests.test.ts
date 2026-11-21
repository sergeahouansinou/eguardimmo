import { ApiError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError, describeFailure } from './errors';
import { INTERVENTION_WORDING } from './interventionErrors';
import { fetchIntervention, fetchInterventionsPage, fetchPhoto, photoPath, reportIntervention } from './interventionRequests';
import { INTERVENTION_IDS as IDS, interventionsPage, openDetail } from './interventionResponses.fixtures';

function clientFor(reply: () => Response) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    calls.push({ url: new URL(input instanceof Request ? input.url : String(input)), init });
    return Promise.resolve(reply());
  });
  return { calls, fetchImpl, client: createApiClient({ baseUrl: 'https://api.test', fetchImpl, readCookie: () => 'x' }) };
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('requêtes des interventions du locataire', () => {
  it('lit la page par curseur et expose la prochaine page', async () => {
    const { client, calls } = clientFor(() => json(200, { ...interventionsPage, meta: { ...interventionsPage.meta, next_cursor: 'abc' } }));

    const page = await fetchInterventionsPage(client, 'precedent');

    expect(calls[0]?.url.pathname).toBe('/api/v1/tenant/interventions');
    expect(calls[0]?.url.searchParams.get('cursor')).toBe('precedent');
    expect(page.nextCursor).toBe('abc');
    expect(page.items.map((item) => item.state)).toEqual(['reported', 'declined', 'cancelled', 'done']);
  });

  it('refuse une réponse hors contrat plutôt que de l’afficher', async () => {
    const { client } = clientFor(() => json(200, { data: { ...openDetail.data, state: 'quoting' } }));

    await expect(fetchIntervention(client, IDS.open)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('envoie la clé d’idempotence en en-tête et jamais dans le corps', async () => {
    const { client, calls } = clientFor(() => json(201, openDetail));

    await reportIntervention(client, {
      leaseId: IDS.lease,
      unitId: null,
      commonArea: true,
      natureTermId: IDS.nature,
      title: '  Fuite  ',
      description: 'Eau au plafond',
      room: '',
      reportedUrgency: 'urgent',
      availability: '',
      idempotencyKey: 'cle-signalement-0001',
    });

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('cle-signalement-0001');
    const body = JSON.parse(calls[0]?.init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Fuite', unit_id: null, common_area: true, room: null, availability: null });
    expect(body).not.toHaveProperty('idempotency_key');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('organization_id');
  });

  it('encode les identifiants dans le chemin du téléchargement', () => {
    expect(photoPath('a/b', 'c d')).toBe('/api/v1/tenant/interventions/a%2Fb/files/c%20d');
  });

  it('refuse un téléchargement qui n’est pas une image', async () => {
    const { client } = clientFor(() => json(200, {}));
    const html = () => Promise.resolve(new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));

    await expect(fetchPhoto(client, '/x', html)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('traduction des erreurs des interventions du locataire', () => {
  const error = (status: number, code: string) => new ApiError(status, code, 'texte serveur');

  it.each([
    [404, 'intervention_not_found', 'n’existe pas'],
    [404, 'intervention_visit_not_found', 'rendez-vous'],
    [409, 'intervention_transition_invalid', 'a déjà avancé'],
    [409, 'visit_status_invalid', 'a déjà évolué'],
    [409, 'maintenance_idempotency_key_reused', 'déjà été enregistré'],
    [422, 'intervention_lease_not_active', 'pas en cours'],
    [422, 'intervention_too_many_open', 'demandes ouvertes'],
    [422, 'intervention_unit_invalid', 'ne fait pas partie'],
    [422, 'intervention_files_limit', 'maximal de photos'],
    [422, 'intervention_file_invalid', 'JPG ou PNG'],
    [422, 'idempotency_key_required', 'clé de saisie'],
    [503, 'service_unavailable', 'indisponible'],
  ])('%s %s est traduit en français', (status, code, text) => {
    const failure = describeFailure(error(status, code), INTERVENTION_WORDING);

    expect(failure.message).toContain(text);
    expect(failure.message).not.toContain('serveur');
  });

  it('garde le message de 401, 403 et 429 génériques', () => {
    expect(describeFailure(error(401, 'x'), INTERVENTION_WORDING).kind).toBe('unauthenticated');
    expect(describeFailure(error(403, 'x'), INTERVENTION_WORDING).kind).toBe('forbidden');
    expect(describeFailure(error(429, 'x'), INTERVENTION_WORDING).kind).toBe('rateLimited');
  });
});
