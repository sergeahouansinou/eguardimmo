import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import {
  preferencesAccountOnly,
  preferencesOwner,
  preferencesOwnerAndAccount,
  preferencesStaff,
  preferencesStaffAndAccount,
  preferencesStaffAndOwner,
  preferencesStaffSaved,
  preferencesTenant,
  preferencesTenantAndAccount,
} from './preferences.fixtures';
import { NotificationPreferencesPage } from './PreferencesPage';
import { NotificationPreferencesPanel } from './PreferencesPanel';
import { ORGANIZATION_ID, mandatoryChannelProblem, unauthenticatedProblem, validationProblem } from './responses.fixtures';
import { TestLink, renderWithApi, stubApi } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

const GET = 'GET /api/v1/notifications/preferences';
const PUT = 'PUT /api/v1/notifications/preferences';

function renderStaff() {
  return renderWithApi(<NotificationPreferencesPanel audience="staff" />, ORGANIZATION_ID);
}

const switchOf = (label: string) => screen.getByRole('switch', { name: label });

describe('préférences de notification en mode API', () => {
  it('affiche chaque type par canal (application, e-mail), sans le canal mobile', async () => {
    stubApi({ [GET]: { body: preferencesStaff } });

    renderStaff();

    const finances = await screen.findByRole('region', { name: 'Finances' });
    expect(within(finances).getByText('Loyer en retard')).toBeTruthy();
    expect(switchOf('Loyer en retard, Application').getAttribute('aria-checked')).toBe('true');
    expect(switchOf('Paiement enregistré, E-mail').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('region', { name: 'Conformité' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Mobile/ })).toBeNull();
    expect(screen.getAllByRole('switch')).toHaveLength(14);
  });

  it('verrouille les canaux obligatoires et l’explique', async () => {
    stubApi({ [GET]: { body: preferencesStaff } });

    const { user } = renderStaff();

    const locked = await screen.findByRole('switch', { name: 'Paiement annulé, Application' });
    expect(locked.hasAttribute('disabled')).toBe(true);
    expect(locked.getAttribute('aria-checked')).toBe('true');
    expect(locked.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getAllByText('Obligatoire : ce canal reste actif pour cet événement.')).toHaveLength(3);
    await user.click(locked);
    expect(locked.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Enregistrer' }).hasAttribute('disabled')).toBe(true);
  });

  it('n’envoie que les valeurs modifiées, puis confirme l’enregistrement', async () => {
    const api = stubApi({ [GET]: { body: preferencesStaff }, [PUT]: { body: preferencesStaffSaved } });

    const { user } = renderStaff();

    await user.click(await screen.findByRole('switch', { name: 'Loyer en retard, E-mail' }));
    expect(switchOf('Loyer en retard, E-mail').getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Préférences enregistrées.')).toBeTruthy();
    expect(api.callsTo('PUT', '/api/v1/notifications/preferences')[0]?.body).toEqual({
      preferences: [{ type: 'rent.overdue', channel: 'email', enabled: false }],
    });
    expect(switchOf('Loyer en retard, E-mail').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Enregistrer' }).hasAttribute('disabled')).toBe(true);
  });

  it('annule les modifications non enregistrées sans appeler le serveur', async () => {
    const api = stubApi({ [GET]: { body: preferencesStaff } });

    const { user } = renderStaff();

    await user.click(await screen.findByRole('switch', { name: 'Loyer en retard, Application' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(switchOf('Loyer en retard, Application').getAttribute('aria-checked')).toBe('true');
    expect(api.callsTo('PUT', '/api/v1/notifications/preferences')).toHaveLength(0);
  });

  it('traduit le refus d’un canal obligatoire et garde les modifications', async () => {
    stubApi({ [GET]: { body: preferencesStaff }, [PUT]: { status: 422, body: mandatoryChannelProblem } });

    const { user } = renderStaff();

    await user.click(await screen.findByRole('switch', { name: 'Loyer en retard, E-mail' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Les préférences n’ont pas pu être enregistrées')).toBeTruthy();
    expect(screen.getByText('Ce canal ne peut pas être désactivé pour ce type de notification.')).toBeTruthy();
    expect(switchOf('Loyer en retard, E-mail').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText('Préférences enregistrées.')).toBeNull();
  });

  it('traduit une validation refusée par le serveur', async () => {
    stubApi({ [GET]: { body: preferencesStaff }, [PUT]: { status: 422, body: validationProblem } });

    const { user } = renderStaff();

    await user.click(await screen.findByRole('switch', { name: 'Loyer en retard, E-mail' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Certaines informations sont invalides.')).toBeTruthy();
  });

  it('ne montre au locataire que ses types, et à l’équipe que les siens', async () => {
    stubApi({ [GET]: { body: preferencesTenant } });
    renderWithApi(<NotificationPreferencesPanel audience="tenant" />, null);

    expect(await screen.findByRole('switch', { name: 'Quittance émise, E-mail' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Loyers' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Finances' })).toBeNull();
  });

  it('affiche au propriétaire ses types, avec les canaux obligatoires verrouillés', async () => {
    stubApi({ [GET]: { body: preferencesOwner } });
    renderWithApi(<NotificationPreferencesPanel audience="owner" />, null);

    expect(await screen.findByRole('form', { name: 'Préférences de notification du propriétaire' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Compte de paiement' })).toBeTruthy();
    expect(switchOf('Accord demandé, E-mail').getAttribute('aria-checked')).toBe('true');
    expect(switchOf('Changement de compte de paiement contesté, E-mail').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('switch', { name: /Mobile/ })).toBeNull();
  });

  it('accepte une matrice mêlant types d’équipe et de propriétaire et les sépare par audience', async () => {
    stubApi({ [GET]: { body: preferencesStaffAndOwner } });
    renderStaff();

    expect(await screen.findByRole('region', { name: 'Finances' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Comptes rendus' })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Accord demandé/ })).toBeNull();
  });

  it.each([
    ['staff', preferencesStaffAndAccount, 'Loyer en retard, E-mail'],
    ['tenant', preferencesTenantAndAccount, 'Quittance émise, E-mail'],
    ['owner', preferencesOwnerAndAccount, 'Accord demandé, E-mail'],
  ] as const)('affiche les types du compte avec ceux de l’espace %s', async (audience, matrix, own) => {
    stubApi({ [GET]: { body: matrix } });
    renderWithApi(<NotificationPreferencesPanel audience={audience} />, null);

    expect(await screen.findByRole('switch', { name: own })).toBeTruthy();
    expect(switchOf('Réponse du support, E-mail').getAttribute('aria-checked')).toBe('true');
    expect(switchOf('Actualités et offres, E-mail').getAttribute('aria-checked')).toBe('false');
  });

  it('permet d’adhérer aux actualités quand le compte n’a que des types de compte', async () => {
    const api = stubApi({ [GET]: { body: preferencesAccountOnly }, [PUT]: { body: preferencesAccountOnly } });

    const { user } = renderStaff();

    await user.click(await screen.findByRole('switch', { name: 'Actualités et offres, E-mail' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Préférences enregistrées.')).toBeTruthy();
    expect(api.callsTo('PUT', '/api/v1/notifications/preferences')[0]?.body).toEqual({
      preferences: [{ type: 'account.marketing', channel: 'email', enabled: true }],
    });
  });

  it('affiche un message honnête quand aucun type ne concerne l’audience', async () => {
    stubApi({ [GET]: { body: preferencesTenant } });

    renderStaff();

    expect(await screen.findByText('Aucune notification ne vous concerne pour l’instant.')).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('traduit l’erreur 401 du chargement et propose de se reconnecter', async () => {
    stubApi({ [GET]: { status: 401, body: unauthenticatedProblem } });

    renderStaff();

    expect(await screen.findByText('Votre session a expiré. Reconnectez-vous pour continuer.')).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('est accessible et expose la page avec son lien vers toutes les notifications', async () => {
    stubApi({ [GET]: { body: preferencesStaff } });

    const { container } = renderWithApi(<NotificationPreferencesPage audience="staff" Link={TestLink} allHref="/notifications" />, ORGANIZATION_ID);

    await screen.findByRole('switch', { name: 'Loyer en retard, E-mail' });
    expect(screen.getByRole('heading', { level: 1, name: 'Préférences de notification' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir toutes les notifications' }).getAttribute('href')).toBe('/notifications');
    await waitFor(() => { expect(screen.getAllByRole('switch').length).toBeGreaterThan(0); });
    await expectNoA11yViolations(container);
  });
});
