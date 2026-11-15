import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { ConfirmDialog } from './ConfirmDialog';

const props = {
  title: 'Annuler l’avis d’échéance ?',
  description: 'L’avis reste consultable mais n’est plus appelé.',
  confirmLabel: 'Annuler l’avis',
};

describe('ConfirmDialog', () => {
  it('ne rend rien tant qu’il est fermé', () => {
    render(<ConfirmDialog {...props} open={false} onOpenChange={() => undefined} onConfirm={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirme l’action', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...props} open onOpenChange={() => undefined} onConfirm={onConfirm} />);
    expect(screen.getByRole('dialog', { name: props.title })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler l’avis' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('se ferme sans confirmer sur « Annuler »', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...props} open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('bloque la confirmation pendant l’envoi et n’a aucune violation axe', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...props} open loading tone="danger" onOpenChange={() => undefined} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler l’avis' }));
    expect(onConfirm).not.toHaveBeenCalled();
    await expectNoA11yViolations(document.body);
  });
});
