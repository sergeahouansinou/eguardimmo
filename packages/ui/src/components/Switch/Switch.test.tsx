import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Switch } from './Switch';

describe('Switch', () => {
  it('expose son état et le bascule au clic', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Mentionner sur la quittance" checked={false} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch', { name: 'Mentionner sur la quittance' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('masque visuellement son libellé tout en le gardant accessible', () => {
    render(<Switch label="Notifier par e-mail" hideLabel checked onCheckedChange={vi.fn()} />);
    expect(screen.getByText('Notifier par e-mail').className).toContain('sr-only');
    expect(screen.getByRole('switch', { name: 'Notifier par e-mail' })).toBeTruthy();
  });

  it('se bascule aussi depuis son libellé et au clavier', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Déductible" checked onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByText('Déductible'));
    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, false);
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false);
  });

  it('ne réagit pas quand il est désactivé et n’a aucune violation axe', async () => {
    const onCheckedChange = vi.fn();
    const { container } = render(<Switch label="Verrouillé" checked disabled onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });
});
