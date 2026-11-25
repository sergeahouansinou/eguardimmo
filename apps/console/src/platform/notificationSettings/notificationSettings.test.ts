import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { problem } from '../fixtures';
import { jsonResponse, setupApi } from '../testApi';
import { lockedNotificationType, notificationType, reminder, rentDueReminder } from './fixtures';
import { notificationSettingsApi } from './notificationSettings';

const ROOT = '/api/v1/console/notifications';

describe('API des réglages de notifications et de rappels', () => {
  it('lit les types et n’envoie que les changements en PUT', async () => {
    const rows = [notificationType(), lockedNotificationType()];
    const { client, url, method, body } = setupApi(jsonResponse(200, { data: rows }), jsonResponse(200, { data: rows }));
    const api = notificationSettingsApi(client);

    expect((await api.types())[1]?.channels[0]).toEqual({ channel: 'in_app', label: 'Application', enabled: true, locked: true, default: true });
    await api.updateTypes([{ type: 'rent.overdue', channel: 'email', enabled: false }]);
    expect([url(0).pathname, method(1), url(1).pathname]).toEqual([`${ROOT}/types`, 'PUT', `${ROOT}/types`]);
    expect(body(1)).toEqual({ changes: [{ type: 'rent.overdue', channel: 'email', enabled: false }] });
  });

  it('lit les rappels et enregistre l’un d’eux', async () => {
    const { client, url, method, body } = setupApi(jsonResponse(200, { data: [reminder(), rentDueReminder()] }), jsonResponse(200, { data: reminder({ enabled: true }) }));
    const api = notificationSettingsApi(client);

    expect((await api.reminders()).map((row) => [row.code, row.timing, row.repeat_every_days])).toEqual([
      ['account_inactive', 'after', 30],
      ['rent_due_soon', 'before', null],
    ]);
    const saved = await api.updateReminder('account_inactive', { enabled: true, delay_days: 14, repeat_every_days: null, max_occurrences: 1, channels: ['email'] });
    expect(saved.enabled).toBe(true);
    expect([method(1), url(1).pathname]).toEqual(['PUT', `${ROOT}/reminders/account_inactive`]);
    expect(body(1)).toEqual({ enabled: true, delay_days: 14, repeat_every_days: null, max_occurrences: 1, channels: ['email'] });
  });

  it.each([
    [404, 'reminder_not_found'],
    [422, 'notification_channel_mandatory'],
  ])('remonte l’erreur %i %s', async (status, code) => {
    const { client } = setupApi(jsonResponse(status, problem(status, code, 'Refus.')));
    const failure = await notificationSettingsApi(client).updateTypes([]).catch((error: unknown) => error);

    expect(describeProblem(failure).code).toBe(code);
  });

  it('refuse une réponse hors contrat', async () => {
    const { client } = setupApi(jsonResponse(200, { data: [reminder({ timing: 'during' })] }));

    await expect(notificationSettingsApi(client).reminders()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});
