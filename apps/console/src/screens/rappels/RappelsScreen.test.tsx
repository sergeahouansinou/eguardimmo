import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { problem, roleRequired } from '@/platform/fixtures';
import { lockedNotificationType, notificationType, reminder, rentDueReminder } from '@/platform/notificationSettings/fixtures';
import { consolePath } from '../abonnements/testSupport';
import { RappelsScreen } from './RappelsScreen';

interface Setup {
  reminders?: () => Response;
  types?: () => Response;
  write?: (request: RecordedRequest) => Response;
}

function open({ reminders, types, write }: Setup = {}) {
  return renderPlatform(<RappelsScreen />, (request) => {
    const path = consolePath(request);
    if (request.method === 'PUT') return write?.(request);
    if (path === '/notifications/reminders') return reminders?.() ?? json(200, { data: [reminder(), rentDueReminder()] });
    if (path === '/notifications/types') return types?.() ?? json(200, { data: [notificationType(), lockedNotificationType()] });
    return undefined;
  });
}

const card = async (name: string) => within(await screen.findByRole('form', { name }));
const save = (scope: Awaited<ReturnType<typeof card>>) => scope.getByRole<HTMLButtonElement>('button', { name: 'Enregistrer' });

describe('rappels automatiques', () => {
  it('groupe les rappels par catégorie avec leur échéance et leur dernier passage', async () => {
    const view = open();

    expect(await screen.findByRole('region', { name: 'Rappels : Comptes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Rappels : Locataires' })).toBeTruthy();
    const inactive = await card('Compte inactif');
    expect(inactive.getByText(/après 14 jours/)).toBeTruthy();
    expect(inactive.getByText('Aucun passage pour l’instant.')).toBeTruthy();
    const rent = await card('Échéance à venir');
    expect(rent.getByText(/3 jours avant/)).toBeTruthy();
    expect(rent.getByText(/12 rappels envoyés/)).toBeTruthy();
    expect(rent.queryByRole('button', { name: '7 jours' })).toBeTruthy();
    expect(rent.queryByRole('button', { name: '30 jours' })).toBeNull();
    expect(rent.getByRole<HTMLInputElement>('spinbutton', { name: 'Nombre maximal d’envois' }).disabled).toBe(true);
    expect(save(rent).disabled).toBe(true);
    await expectNoA11yViolations(view.container);
  });

  it('enregistre un seul rappel avec tous ses champs', async () => {
    let enabled = false;
    const view = open({
      reminders: () => json(200, { data: [reminder(enabled ? { enabled, delay_days: 30, channels: ['email'] } : {}), rentDueReminder()] }),
      write: () => {
        enabled = true;
        return json(200, { data: reminder({ enabled, delay_days: 30, channels: ['email'] }) });
      },
    });
    const user = userEvent.setup();
    const inactive = await card('Compte inactif');
    await user.click(inactive.getByRole('switch', { name: 'Activer : Compte inactif' }));
    await user.click(inactive.getByRole('button', { name: '30 jours' }));
    await user.click(inactive.getByRole('checkbox', { name: 'Mobile' }));
    await user.click(save(inactive));

    expect(await screen.findByText('Rappel enregistré')).toBeTruthy();
    expect(view.writes()).toHaveLength(1);
    expect(view.writes()[0]?.url.pathname).toBe('/api/v1/console/notifications/reminders/account_inactive');
    expect(view.writes()[0]?.body).toEqual({ enabled: true, delay_days: 30, repeat_every_days: 30, max_occurrences: 2, channels: ['email'] });
    await waitFor(() => { expect(save(inactive).disabled).toBe(true); });
    expect(inactive.getByRole('switch', { name: 'Activer : Compte inactif' }).getAttribute('aria-checked')).toBe('true');
  });

  it('impose un seul envoi sans répétition', async () => {
    const view = open({ write: () => json(200, { data: reminder({ repeat_every_days: null, max_occurrences: 1 }) }) });
    const user = userEvent.setup();
    const inactive = await card('Compte inactif');
    await user.click(inactive.getByRole('combobox', { name: /Répétition/ }));
    await user.click(await screen.findByRole('option', { name: 'Aucune répétition' }));
    await user.click(save(inactive));

    await waitFor(() => { expect(view.writes()).toHaveLength(1); });
    expect(view.writes()[0]?.body).toMatchObject({ repeat_every_days: null, max_occurrences: 1 });
  });

  it('refuse hors bornes et sans canal, sans appeler le serveur', async () => {
    const view = open();
    const user = userEvent.setup();
    const inactive = await card('Compte inactif');
    const delay = inactive.getByRole('spinbutton', { name: 'Délai (jours)' });
    await user.clear(delay);
    await user.type(delay, '3');
    const repeat = inactive.getByRole('spinbutton', { name: 'Intervalle (jours)' });
    await user.clear(repeat);
    await user.type(repeat, '181');
    const most = inactive.getByRole('spinbutton', { name: 'Nombre maximal d’envois' });
    await user.clear(most);
    await user.type(most, '6');
    await user.click(inactive.getByRole('checkbox', { name: 'E-mail' }));
    await user.click(inactive.getByRole('checkbox', { name: 'Mobile' }));
    await user.click(save(inactive));

    expect(inactive.getByText('Saisissez un nombre entre 7 et 365.')).toBeTruthy();
    expect(inactive.getByText('Saisissez un nombre entre 1 et 180.')).toBeTruthy();
    expect(inactive.getByText('Saisissez un nombre entre 1 et 5.')).toBeTruthy();
    expect(inactive.getByText('Gardez au moins un canal.')).toBeTruthy();
    expect(view.writes()).toEqual([]);
  });

  it('applique le plafond d’envois propre à un rappel', async () => {
    const view = open({ reminders: () => json(200, { data: [reminder({ occurrences_limit: 2 })] }) });
    const user = userEvent.setup();
    const inactive = await card('Compte inactif');
    const most = inactive.getByRole('spinbutton', { name: 'Nombre maximal d’envois' });
    expect(most.getAttribute('max')).toBe('2');
    await user.clear(most);
    await user.type(most, '3');
    await user.click(save(inactive));

    expect(inactive.getByText('Saisissez un nombre entre 1 et 2.')).toBeTruthy();
    expect(view.writes()).toEqual([]);
  });

  it('signale un rappel disparu et garde la saisie', async () => {
    open({ write: () => json(404, problem(404, 'reminder_not_found', 'Inconnu.')) });
    const user = userEvent.setup();
    const inactive = await card('Compte inactif');
    await user.click(inactive.getByRole('switch'));
    await user.click(save(inactive));

    expect(await inactive.findByText('Ce rappel n’existe plus sur le serveur. Rechargez la page.')).toBeTruthy();
    expect(inactive.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('signale un rôle insuffisant', async () => {
    open({ reminders: () => json(403, roleRequired) });

    expect(await screen.findByText('Accès réservé')).toBeTruthy();
  });
});

describe('canaux des notifications', () => {
  const openTypes = async (setup?: Setup) => {
    const view = open(setup);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Notifications' }));
    await screen.findByRole('form', { name: 'Canaux des notifications' });
    return { view, user };
  };

  it('groupe par audience, verrouille les canaux obligatoires et l’explique', async () => {
    const { view } = await openTypes();

    expect(screen.getByRole('region', { name: 'Notifications : Équipes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Notifications : Locataires' })).toBeTruthy();
    const locked = screen.getByRole<HTMLButtonElement>('switch', { name: 'Paiement annulé, Application' });
    expect(locked.disabled).toBe(true);
    expect(locked.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Obligatoire : ce canal ne peut pas être coupé.')).toBeTruthy();
    await expectNoA11yViolations(view.container);
  });

  it('enregistre en une fois les seuls changements', async () => {
    const { view, user } = await openTypes({ write: () => json(200, { data: [notificationType(), lockedNotificationType()] }) });
    await user.click(screen.getByRole('switch', { name: 'Loyer en retard, E-mail' }));
    await user.click(screen.getByRole('switch', { name: 'Paiement annulé, E-mail' }));
    await user.click(screen.getByRole('switch', { name: 'Loyer en retard, Mobile' }));
    await user.click(screen.getByRole('switch', { name: 'Loyer en retard, Application' }));
    await user.click(screen.getByRole('switch', { name: 'Loyer en retard, Application' }));
    expect(screen.getByText('3 changements à enregistrer')).toBeTruthy();
    await user.click(within(screen.getByRole('form', { name: 'Canaux des notifications' })).getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Réglages enregistrés')).toBeTruthy();
    expect(view.writes()).toHaveLength(1);
    expect(view.writes()[0]?.body).toEqual({
      changes: [
        { type: 'rent.overdue', channel: 'email', enabled: false },
        { type: 'rent.overdue', channel: 'push', enabled: true },
        { type: 'tenant.payment_cancelled', channel: 'email', enabled: false },
      ],
    });
  });

  it('traduit le refus d’un canal obligatoire et garde les changements', async () => {
    const { user } = await openTypes({ write: () => json(422, problem(422, 'notification_channel_mandatory', 'Refus.')) });
    await user.click(screen.getByRole('switch', { name: 'Loyer en retard, E-mail' }));
    await user.click(within(screen.getByRole('form', { name: 'Canaux des notifications' })).getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Un canal obligatoire ne peut pas être coupé.')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Loyer en retard, E-mail' }).getAttribute('aria-checked')).toBe('false');
  });
});
