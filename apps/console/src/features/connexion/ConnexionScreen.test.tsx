import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_OPERATOR_CODE, DEMO_OPERATOR_EMAIL, DEMO_OPERATOR_PASSWORD } from '@/console/demo/credentials';
import { LOGIN_FAILURE_MESSAGE } from '@/console/schemas';
import { expectNoA11yViolations } from '../../../test/axe';
import { router } from '../../../test/navigation';
import { renderWithConsole } from '../../../test/render';
import { ConnexionScreen } from './ConnexionScreen';

async function fill(email: string, password: string, code: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Mot de passe'), password);
  await user.type(screen.getByLabelText('Code à 6 chiffres'), code);
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('ConnexionScreen', () => {
  beforeEach(() => {
    router.replace.mockClear();
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = renderWithConsole(<ConnexionScreen />);
    await expectNoA11yViolations(container);
  });

  it('connecte avec les trois facteurs et redirige vers la vue d’ensemble', async () => {
    renderWithConsole(<ConnexionScreen />);
    await fill(DEMO_OPERATOR_EMAIL, DEMO_OPERATOR_PASSWORD, DEMO_OPERATOR_CODE);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith('/'); });
  });

  it('affiche le même message pour un compte inconnu et pour un mauvais mot de passe', async () => {
    const first = renderWithConsole(<ConnexionScreen />);
    await fill('inconnu@exemple.fr', 'un-mot-de-passe-long', '123456');
    const unknown = (await screen.findByRole('alert')).textContent;
    first.unmount();

    renderWithConsole(<ConnexionScreen />);
    await fill(DEMO_OPERATOR_EMAIL, 'un-mot-de-passe-long', '123456');
    const wrong = (await screen.findByRole('alert')).textContent;

    expect(unknown).toContain(LOGIN_FAILURE_MESSAGE);
    expect(wrong).toBe(unknown);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('vide le mot de passe et le code après un échec', async () => {
    renderWithConsole(<ConnexionScreen />);
    await fill(DEMO_OPERATOR_EMAIL, 'un-mot-de-passe-long', '123456');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Mot de passe')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Code à 6 chiffres')).toHaveProperty('value', '');
  });

  it('signale les champs vides sans interroger le serveur', async () => {
    const { source } = renderWithConsole(<ConnexionScreen />);
    const login = vi.spyOn(source.auth, 'login');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((await screen.findAllByText(/./, { selector: '[id$="-error"], [role="alert"]' })).length).toBeGreaterThan(0);
    expect(login).not.toHaveBeenCalled();
  });

  it('annonce le blocage au cinquième échec', async () => {
    const { source } = renderWithConsole(<ConnexionScreen />);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await source.auth.login({ email: DEMO_OPERATOR_EMAIL, password: 'un-mot-de-passe-long', code: '123456' });
    }
    await fill(DEMO_OPERATOR_EMAIL, 'un-mot-de-passe-long', '123456');
    expect(await screen.findByText(/Trop de tentatives/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
