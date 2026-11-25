import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Combobox } from './Combobox';
import type { ComboboxOption } from './Combobox';

const options: ComboboxOption[] = [
  { value: 'lyon', label: 'Lyon', description: '69000' },
  { value: 'lille', label: 'Lille', description: '59000' },
];

function Exemple({ onSelect }: { onSelect?: (option: ComboboxOption) => void }) {
  const [value, setValue] = useState('');
  return (
    <Combobox
      label="Destination"
      placeholder="Ville ou code postal"
      value={value}
      onValueChange={setValue}
      options={options}
      onSelect={(option) => {
        setValue(option.label);
        onSelect?.(option);
      }}
    />
  );
}

describe('Combobox', () => {
  it('reste fermée sous le seuil de caractères puis propose les suggestions', async () => {
    render(<Exemple />);
    const input = screen.getByRole('combobox', { name: 'Destination' });
    await userEvent.type(input, 'L');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.type(input, 'y');
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('choisit une suggestion au clavier et ferme la liste', async () => {
    const onSelect = vi.fn();
    render(<Exemple onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'Ly');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(options[1]);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('Lille');
  });

  it('Entrée sans suggestion active ne choisit rien et Échap ferme', async () => {
    const onSelect = vi.fn();
    render(<Exemple onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('combobox'), 'Ly');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('choisit à la souris', async () => {
    const onSelect = vi.fn();
    render(<Exemple onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('combobox'), 'Ly');
    await userEvent.click(await screen.findByRole('option', { name: /Lyon/ }));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });

  it('n’a aucune violation d’accessibilité, liste ouverte', async () => {
    const { container } = render(<Exemple />);
    await userEvent.type(screen.getByRole('combobox'), 'Ly');
    await expectNoA11yViolations(container);
  });
});
