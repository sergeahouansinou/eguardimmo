import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

describe('Popover', () => {
  it('ouvre un dialogue nommé et le ferme avec Échap', async () => {
    render(
      <Popover>
        <PopoverTrigger>Notifications</PopoverTrigger>
        <PopoverContent aria-label="Notifications">Aucune notification</PopoverContent>
      </Popover>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect((await screen.findByRole('dialog', { name: 'Notifications' })).textContent).toBe('Aucune notification');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
