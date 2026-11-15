import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('se coche au clic sur la case et sur son libellé', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Tout sélectionner" onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tout sélectionner' }));
    await userEvent.click(screen.getByText('Tout sélectionner'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('garde un nom accessible quand le libellé est masqué', async () => {
    const { container } = render(<Checkbox label="Sélectionner la ligne" hideLabel defaultChecked />);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Sélectionner la ligne' }).checked).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('respecte l’état désactivé', () => {
    render(<Checkbox label="Verrouillé" disabled />);
    expect(screen.getByRole<HTMLInputElement>('checkbox').disabled).toBe(true);
  });
});
