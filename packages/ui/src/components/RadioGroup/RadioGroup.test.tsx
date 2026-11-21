import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './RadioGroup';

const options = [
  { value: 'electrique', label: 'Électrique' },
  { value: 'gaz', label: 'Gaz' },
  { value: 'pac', label: 'Pompe à chaleur', disabled: true },
];

describe('RadioGroup', () => {
  it('regroupe les choix sous une légende et coche la valeur courante', () => {
    render(<RadioGroup label="Chauffage" options={options} value="gaz" onValueChange={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Chauffage' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Gaz' }).checked).toBe(true);
  });

  it('notifie le choix et ignore une option désactivée', async () => {
    const onValueChange = vi.fn();
    render(<RadioGroup label="Chauffage" options={options} value="gaz" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Électrique' }));
    expect(onValueChange).toHaveBeenCalledWith('electrique');
    await userEvent.click(screen.getByRole('radio', { name: 'Pompe à chaleur' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('affiche l’erreur', () => {
    render(<RadioGroup label="Chauffage" options={options} value="" error="Champ requis" onValueChange={() => undefined} />);
    expect(screen.getByText('Champ requis')).toBeTruthy();
  });

  it('donne à chaque choix une zone cliquable d’au moins 24 px', () => {
    render(<RadioGroup label="Chauffage" options={options} value="gaz" onValueChange={() => undefined} />);
    expect(screen.getByText('Gaz').className).toContain('min-h-6');
    expect(screen.getByText('Gaz').parentElement?.className).toContain('min-h-6');
  });
});
