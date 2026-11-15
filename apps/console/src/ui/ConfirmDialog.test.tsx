import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { ConfirmDialog } from './ConfirmDialog';

function setup(onConfirm: () => Promise<void>) {
  const onOpenChange = vi.fn();
  const view = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Confirmer la restauration"
      description="Les données actuelles seront remplacées."
      confirmLabel="Restaurer"
      tone="danger"
      requiredPhrase="sauvegarde-2026-11-13"
      phraseLabel="Nom de la sauvegarde"
      onConfirm={onConfirm}
    />,
  );
  return { ...view, onOpenChange };
}

describe('ConfirmDialog avec saisie du nom', () => {
  it('bloque la confirmation tant que le nom exact n’est pas saisi', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    setup(onConfirm);
    const user = userEvent.setup();
    const confirm = screen.getByRole('button', { name: 'Restaurer' });
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(screen.getByLabelText('Nom de la sauvegarde'), 'sauvegarde-2026-11-1');
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(screen.getByLabelText('Nom de la sauvegarde'), '3');
    expect(confirm).toHaveProperty('disabled', false);
    await user.click(confirm);
    await waitFor(() => { expect(onConfirm).toHaveBeenCalledTimes(1); });
  });

  it('affiche l’échec sans fermer le dialogue', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('Le serveur a refusé.')));
    const { onOpenChange } = setup(onConfirm);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nom de la sauvegarde'), 'sauvegarde-2026-11-13');
    await user.click(screen.getByRole('button', { name: 'Restaurer' }));
    expect(await screen.findByText('Le serveur a refusé.')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('annuler ne confirme rien', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const { onOpenChange } = setup(onConfirm);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('n’a aucune violation d’accessibilité', async () => {
    setup(() => Promise.resolve());
    await expectNoA11yViolations(document.body);
  });
});
