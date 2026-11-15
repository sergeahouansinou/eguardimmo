import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Select } from './Select';
import type { SelectOption } from './Select';

const options: SelectOption[] = [
  { value: 'haute', label: 'Haute' },
  { value: 'normale', label: 'Normale', description: 'Délai standard' },
  { value: 'basse', label: 'Basse' },
  { value: 'élevée', label: 'Élevée' },
];

function Exemple({ onChange, initial = '' }: { onChange?: (value: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Select
      label="Priorité"
      placeholder="Choisir une priorité"
      options={options}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      searchable
      searchPlaceholder="Rechercher une priorité"
    />
  );
}

describe('Select', () => {
  it('affiche le placeholder puis la valeur choisie à la souris', async () => {
    const onChange = vi.fn();
    render(<Exemple onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: /Priorité/ });
    expect(trigger.textContent).toContain('Choisir une priorité');
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: /Normale/ }));
    expect(onChange).toHaveBeenCalledWith('normale');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: /Priorité/ }).textContent).toContain('Normale');
  });

  it('filtre sans tenir compte des accents et navigue au clavier', async () => {
    const onChange = vi.fn();
    render(<Exemple onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    const search = await screen.findByRole('searchbox', { name: 'Rechercher une priorité' });
    await userEvent.type(search, 'elev');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.clear(search);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('basse');
  });

  it('indique l’absence de résultat', async () => {
    render(<Exemple />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(await screen.findByRole('searchbox'), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('marque l’option courante et se ferme avec Échap', async () => {
    render(<Exemple initial="haute" />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Haute' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('relie l’erreur et ne s’ouvre pas lorsqu’il est désactivé', async () => {
    render(
      <Select label="Statut" placeholder="Choisir" options={options} value="" onValueChange={() => undefined} error="Statut requis" disabled />,
    );
    const trigger = screen.getByRole('combobox', { name: /Statut/ });
    expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByText('Statut requis').id);
    await userEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('n’a aucune violation d’accessibilité, fermé puis ouvert', async () => {
    const { container } = render(<Exemple />);
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('combobox'));
    await expectNoA11yViolations(await screen.findByRole('dialog'));
    await expectNoA11yViolations(container);
  });
});
