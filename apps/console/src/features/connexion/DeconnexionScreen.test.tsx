import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_NOW } from '@/console/demo/clock';
import { createDemoSource } from '@/console/demo/source';
import { auditListSchema } from '@/console/schemas';
import { expectNoA11yViolations } from '../../../test/axe';
import { router } from '../../../test/navigation';
import { renderWithConsole, renderWithSource } from '../../../test/render';
import { DeconnexionScreen } from './DeconnexionScreen';

describe('DeconnexionScreen', () => {
  it('ferme la session opérateur, la journalise et mène à la connexion', async () => {
    router.replace.mockClear();
    const { container, source } = renderWithConsole(<DeconnexionScreen />);
    expect(screen.getByText('Déconnexion en cours…')).toBeTruthy();
    await expectNoA11yViolations(container);
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith('/connexion'); });
    const latest = auditListSchema.parse(await source.audit.list({ pageSize: 1 })).rows[0];
    expect(latest?.title).toBe('Déconnexion opérateur');
  });

  it('signale l’échec de la fermeture au lieu de rediriger, puis réessaie', async () => {
    router.replace.mockClear();
    const user = userEvent.setup();
    const fixed = new Date(DEMO_NOW);
    const source = createDemoSource({ clock: () => fixed });
    const signOut = vi.spyOn(source.auth, 'signOut').mockRejectedValueOnce(new Error('panne'));
    const { container } = renderWithSource(<DeconnexionScreen />, source);
    expect((await screen.findByRole('alert')).textContent).toContain('La déconnexion a échoué');
    expect(router.replace).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => { expect(router.replace).toHaveBeenCalledWith('/connexion'); });
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
