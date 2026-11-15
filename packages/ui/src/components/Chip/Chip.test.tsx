import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  it('expose son état pressé et déclenche le clic', async () => {
    const onClick = vi.fn();
    render(<Chip pressed onClick={onClick}>Loué</Chip>);
    const chip = screen.getByRole('button', { name: 'Loué' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('est non pressé par défaut visuellement', () => {
    render(<Chip pressed={false}>Libre</Chip>);
    expect(screen.getByRole('button', { name: 'Libre' }).getAttribute('aria-pressed')).toBe('false');
  });
});
