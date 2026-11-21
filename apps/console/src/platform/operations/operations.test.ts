import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { ERROR_CASES, jsonResponse, setupApi } from '../testApi';
import { backupReport, backupsResponse, healthResponse, settingsResponse } from './fixtures';
import { fetchBackups, fetchHealth, fetchSettings } from './operations';

const healthWith = (components: Record<string, unknown>, status = 'ok') => ({ data: { ...healthResponse.data, status, components } });

describe('santé de la plateforme', () => {
  it('garde les trois états sans jamais convertir « unknown » en ok ni en down', async () => {
    const { client, url } = setupApi(jsonResponse(200, healthResponse));
    const health = await fetchHealth(client);

    expect(url().pathname).toBe('/api/v1/console/health');
    expect(health.status).toBe('unknown');
    expect(Object.fromEntries(health.components.map((component) => [component.key, component.state]))).toEqual({
      database: 'ok',
      queue: 'ok',
      scheduler: 'ok',
      antivirus: 'unknown',
      pdf: 'ok',
      mail: 'unknown',
      payments: 'unknown',
      backups: 'ok',
    });
    expect(health.monitoringUrl).toBe('https://supervision.exemple.test/');
    expect(health.statusPageUrl).toBeNull();
  });

  it('conserve les détails bruts de chaque sonde sans l’état', async () => {
    const { client } = setupApi(jsonResponse(200, healthResponse));
    const health = await fetchHealth(client);
    const database = health.components.find((component) => component.key === 'database');

    expect(database?.raw).toEqual({ latency_ms: 3 });
    expect(database?.details).toEqual([{ key: 'latency_ms', value: '3' }]);
    expect(health.components.find((component) => component.key === 'antivirus')?.details).toEqual([
      { key: 'enabled', value: 'true' },
      { key: 'latency_ms', value: '—' },
    ]);
  });

  it('lit une file en retard (down) et une file vide d’un pilote non surveillé (unknown)', async () => {
    const down = setupApi(jsonResponse(200, healthWith({ queue: { state: 'down', driver: 'database', queues: [{ queue: 'default', pending: 9, oldest_age_seconds: 4000 }], failed_24h: 2 } }, 'down')));
    expect((await fetchHealth(down.client)).components[0]).toMatchObject({ key: 'queue', state: 'down' });

    const unknown = setupApi(jsonResponse(200, healthWith({ queue: { state: 'unknown', driver: 'sync', queues: [], failed_24h: null } }, 'unknown')));
    expect((await fetchHealth(unknown.client)).components[0]).toMatchObject({ state: 'unknown', raw: { driver: 'sync', queues: [], failed_24h: null } });
  });

  it('refuse un état hors ok/down/unknown et un lien qui n’est pas une URL', async () => {
    await expect(fetchHealth(setupApi(jsonResponse(200, healthWith({ database: { state: 'degraded' } }))).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(fetchHealth(setupApi(jsonResponse(200, healthWith({ database: { state: 'weird' } }, 'weird'))).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    const badLink = { data: { ...healthResponse.data, links: { monitoring_url: 'pas une url', status_page_url: null } } };
    await expect(fetchHealth(setupApi(jsonResponse(200, badLink)).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(ERROR_CASES)('classe l’erreur %i comme %s', async (status, payload, kind, code) => {
    const { client } = setupApi(jsonResponse(status, payload));
    const error: unknown = await fetchHealth(client).catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });
});

describe('sauvegardes', () => {
  it('lit la page avec les dernières réussites et l’ancienneté maximale dans meta', async () => {
    const { client, url } = setupApi(jsonResponse(200, backupsResponse([backupReport(), backupReport({ id: 'b', kind: 'restore_test', duration_seconds: null, size_bytes: null, manifest_sha256: null, restore_test: { target: 'staging', result: 'passed' } })], { has_more: true, next_cursor: 'c2' })));
    const page = await fetchBackups(client, { kind: 'database', succeeded: false, cursor: 'c1', perPage: 10 });

    expect(url().pathname).toBe('/api/v1/console/backups');
    expect(Object.fromEntries(url().searchParams)).toEqual({ kind: 'database', succeeded: '0', cursor: 'c1', per_page: '10' });
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'c2', maxAgeHours: 26, lastSuccess: { database: '2026-11-21T03:00:00+00:00', documents: null } });
    expect(page.rows[0]).toMatchObject({ kind: 'database', durationSeconds: 184, sizeBytes: 41234567890, succeeded: true, restoreTest: null });
    expect(page.rows[1]).toMatchObject({ kind: 'restore_test', durationSeconds: null, sizeBytes: null, manifestSha256: null, restoreTest: { target: 'staging', result: 'passed' } });
  });

  it('n’envoie aucun filtre par défaut et lit un test de restauration sans résultat', async () => {
    const { client, url } = setupApi(jsonResponse(200, backupsResponse([backupReport({ kind: 'restore_test', restore_test: { target: 'staging', result: null } })])));
    const page = await fetchBackups(client);

    expect(Object.fromEntries(url().searchParams)).toEqual({});
    expect(page.rows[0]?.restoreTest).toEqual({ target: 'staging', result: null });
  });

  it('refuse une liste sans last_success_at et un type inconnu', async () => {
    const withoutMeta = { data: [backupReport()], meta: { has_more: false, next_cursor: null, max_age_hours: 26 } };
    await expect(fetchBackups(setupApi(jsonResponse(200, withoutMeta)).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(fetchBackups(setupApi(jsonResponse(200, backupsResponse([backupReport({ kind: 'logs' })]))).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(ERROR_CASES)('classe l’erreur %i comme %s', async (status, payload, kind, code) => {
    const { client } = setupApi(jsonResponse(status, payload));
    const error: unknown = await fetchBackups(client).catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });
});

describe('paramètres effectifs', () => {
  it('met à plat les cinq groupes en lecture seule', async () => {
    const { client, url, method } = setupApi(jsonResponse(200, settingsResponse));
    const settings = await fetchSettings(client);

    expect(method()).toBe('GET');
    expect(url().pathname).toBe('/api/v1/console/settings');
    expect(settings).toEqual({
      consoleTokenMinutes: 480,
      consoleSessionAbsoluteMinutes: 720,
      reauthenticationMinutes: 15,
      webSessionAbsoluteMinutes: 1440,
      supportHours: '09:00-18:00',
      supportTimezone: 'Europe/Paris',
      supportResponseLabel: 'sous 24 h ouvrées',
      broadcastDailyRecipients: 5000,
      broadcastHourlySends: 20,
      broadcastHourlyTests: 10,
      antivirusEnabled: true,
      mailConfigured: false,
      paymentsGateway: 'provider',
      approvalTtlHours: 24,
      privacyExportTtlDays: 30,
      backupMaxAgeHours: 26,
    });
  });

  it('refuse une passerelle inconnue et un groupe manquant', async () => {
    await expect(fetchSettings(setupApi(jsonResponse(200, { data: { ...settingsResponse.data, payments: { gateway: 'stripe' } } })).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
    const incomplete = { data: { ...settingsResponse.data } };
    Reflect.deleteProperty(incomplete.data, 'approvals');
    await expect(fetchSettings(setupApi(jsonResponse(200, incomplete)).client)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it.each(ERROR_CASES)('classe l’erreur %i comme %s', async (status, payload, kind, code) => {
    const { client } = setupApi(jsonResponse(status, payload));
    const error: unknown = await fetchSettings(client).catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind, code });
  });
});
