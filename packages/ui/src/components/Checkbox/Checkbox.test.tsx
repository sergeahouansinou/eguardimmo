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

  it('le mode touch donne au libellé une cible de 44 px', () => {
    render(<Checkbox label="Wi-Fi" touch />);
    expect(screen.getByText('Wi-Fi').className).toContain('min-h-11');
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

  it('offre une zone cliquable d’au moins 24 px de haut autour du libellé, sans changer l’encombrement', () => {
    render(<Checkbox label="Tout sélectionner" />);
    const label = screen.getByText('Tout sélectionner');
    expect(label.classList.contains('min-h-6')).toBe(true);
    expect(label.classList.contains('-my-0.5')).toBe(true);
  });

  it('étend la zone cliquable à 24 px autour de la case quand le libellé est masqué', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Sélectionner la ligne" hideLabel onChange={onChange} />);
    const label = screen.getByText('Sélectionner la ligne');
    expect(label.classList.contains('-inset-1')).toBe(true);
    await userEvent.click(label);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Sélectionner la ligne' }).checked).toBe(true);
  });

  it('ne se coche pas au clic sur le libellé quand il est désactivé', async () => {
    render(<Checkbox label="Verrouillé" disabled />);
    await userEvent.click(screen.getByText('Verrouillé'));
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false);
  });
});
