import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { OrgApiError } from './errors';
import { TimezoneSettingsPage } from './TimezoneSettingsPage';
import { orgInfoStub, renderWithOrg } from './testing';

async function choose(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('combobox', { name: /Fuseau horaire/ }));
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('réglage du fuseau horaire', () => {
  it('enregistre le nouveau fuseau choisi par un administrateur', async () => {
    const user = userEvent.setup();
    const updateTimezone = vi.fn((timezone: string) => Promise.resolve(timezone));
    const { container } = renderWithOrg(<TimezoneSettingsPage />, { info: orgInfoStub({ role: 'admin', updateTimezone }) });
    const save = await screen.findByRole('button', { name: 'Enregistrer' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await choose(user, 'America/Toronto');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(updateTimezone).toHaveBeenCalledWith('America/Toronto'); });
    await expectNoA11yViolations(container);
  });

  it('affiche le refus du serveur sans perdre la sélection', async () => {
    const user = userEvent.setup();
    const updateTimezone = vi.fn(() => Promise.reject(new OrgApiError('forbidden', 'Votre rôle ne permet pas cette action.', { status: 403 })));
    renderWithOrg(<TimezoneSettingsPage />, { info: orgInfoStub({ role: 'owner', updateTimezone }) });
    await choose(user, 'America/Toronto');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Votre rôle ne permet pas cette action.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Fuseau horaire/ }).textContent).toContain('America/Toronto');
  });

  it('affiche une erreur de validation du serveur', async () => {
    const user = userEvent.setup();
    const updateTimezone = vi.fn(() => Promise.reject(new OrgApiError('invalid', 'Ce fuseau horaire n’est pas reconnu.', { status: 422, code: 'validation_failed' })));
    renderWithOrg(<TimezoneSettingsPage />, { info: orgInfoStub({ updateTimezone }) });
    await choose(user, 'Europe/Brussels');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Ce fuseau horaire n’est pas reconnu.')).toBeTruthy();
  });

  it('refuse l’accès aux autres rôles sans interroger le serveur', async () => {
    const timezone = vi.fn(() => Promise.resolve('Europe/Paris'));
    renderWithOrg(<TimezoneSettingsPage />, { info: { ...orgInfoStub({ role: 'manager' }), timezone } });
    expect(await screen.findByText('Accès refusé')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('propose de réessayer quand le fuseau actuel ne se charge pas', async () => {
    const user = userEvent.setup();
    const timezone = vi.fn().mockRejectedValueOnce(new OrgApiError('unavailable', 'Indisponible', { status: 503 })).mockResolvedValue('Europe/Paris');
    renderWithOrg(<TimezoneSettingsPage />, { info: { ...orgInfoStub(), timezone } });
    expect(await screen.findByText(/Impossible de charger le fuseau horaire/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect((await screen.findByRole('combobox', { name: /Fuseau horaire/ })).textContent).toContain('Europe/Paris');
  });
});
