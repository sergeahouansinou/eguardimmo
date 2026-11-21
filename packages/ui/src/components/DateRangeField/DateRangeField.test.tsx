import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { DateRangeField } from './DateRangeField';

function Harness({ error }: { error?: string }) {
  const [from, setFrom] = useState('2026-11-01');
  const [to, setTo] = useState('2026-11-30');
  return <DateRangeField legend="Période du relevé" from={from} to={to} onFromChange={setFrom} onToChange={setTo} hint="366 jours au plus" error={error} />;
}

describe('DateRangeField', () => {
  it('regroupe les deux dates sous une légende et relaie la saisie', async () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Période du relevé' })).toBeTruthy();
    const from = screen.getByLabelText<HTMLInputElement>('Du');
    expect(from.type).toBe('date');
    expect(screen.getByLabelText<HTMLInputElement>('Au').value).toBe('2026-11-30');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-10-15');
    expect(from.value).toBe('2026-10-15');
  });

  it('affiche l’aide, puis l’erreur annoncée à la place', () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByText('366 jours au plus')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<Harness error="La fin précède le début." />);
    expect(screen.getByRole('alert').textContent).toBe('La fin précède le début.');
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(screen.queryByText('366 jours au plus')).toBeNull();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Harness error="La fin précède le début." />);
    await expectNoA11yViolations(container);
  });
});
