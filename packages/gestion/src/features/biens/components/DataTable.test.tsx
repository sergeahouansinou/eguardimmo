import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { useListState } from '../hooks/useListState';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';

interface Item {
  id: string;
  name: string;
  rank: number;
}

const ITEMS: Item[] = Array.from({ length: 12 }, (_, index) => ({ id: `i${String(index + 1)}`, name: `Élément ${String(index + 1).padStart(2, '0')}`, rank: (index * 7) % 12 }));

const COLUMNS: Column<Item>[] = [
  { id: 'name', header: 'Nom', sortBy: (row) => row.name, cell: (row) => row.name },
  { id: 'rank', header: 'Rang', numeric: true, sortBy: (row) => row.rank, cell: (row) => row.rank },
  { id: 'note', header: 'Note', cell: () => 'ok' },
];

function Harness({ rows = ITEMS, footer, selectable = false }: { rows?: Item[]; footer?: boolean; selectable?: boolean }) {
  const list = useListState({ key: 'name', direction: 'asc' });
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <DataTable
        label="Éléments"
        rows={rows}
        columns={COLUMNS}
        getId={(row) => row.id}
        list={list}
        footer={footer}
        selected={selectable ? selected : undefined}
        onSelectedChange={selectable ? setSelected : undefined}
        rowLabel={(row) => row.name}
        empty={<p>Rien à afficher</p>}
      />
      <output aria-label="Sélection">{selected.join(',')}</output>
    </>
  );
}

const bodyRows = () => within(screen.getByRole('table', { name: 'Éléments' })).getAllByRole('row').slice(1);

describe('DataTable', () => {
  it('affiche la première page triée avec la pagination', () => {
    render(<Harness />);
    expect(bodyRows()).toHaveLength(10);
    expect(bodyRows()[0]?.textContent).toContain('Élément 01');
    expect(screen.getByText(/1 à 10 sur 12/)).toBeTruthy();
  });

  it('passe à la page suivante puis change le nombre de lignes par page', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(bodyRows()).toHaveLength(2);
    await userEvent.click(screen.getByRole('combobox', { name: /Lignes par page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '5' }));
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByText(/1 à 5 sur 12/)).toBeTruthy();
  });

  it('trie par colonne dans les deux sens et expose aria-sort', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Rang' }));
    expect(bodyRows()[0]?.textContent).toContain('Élément 01');
    expect(screen.getByRole('columnheader', { name: /Rang/ }).getAttribute('aria-sort')).toBe('ascending');
    await userEvent.click(screen.getByRole('button', { name: 'Rang' }));
    expect(screen.getByRole('columnheader', { name: /Rang/ }).getAttribute('aria-sort')).toBe('descending');
    expect(bodyRows()[0]?.textContent).toContain('Élément 06');
  });

  it('n’offre pas de tri sur une colonne sans critère', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Note' })).toBeNull();
  });

  it('masque le pied de tableau quand footer vaut false', () => {
    render(<Harness footer={false} />);
    expect(screen.queryByRole('combobox', { name: /Lignes par page/ })).toBeNull();
  });

  it('affiche l’état vide quand il n’y a aucune ligne', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('Rien à afficher')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sélectionne une ligne puis toute la page', async () => {
    render(<Harness selectable />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Élément 02' }));
    expect(screen.getByLabelText('Sélection').textContent).toBe('i2');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tout sélectionner sur la page' }));
    expect(screen.getByLabelText('Sélection').textContent.split(',')).toHaveLength(10);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tout sélectionner sur la page' }));
    expect(screen.getByLabelText('Sélection').textContent).toBe('');
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = render(<Harness selectable />);
    await expectNoA11yViolations(container);
  });
});
