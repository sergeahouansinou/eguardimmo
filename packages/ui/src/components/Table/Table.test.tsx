import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table';

function Sample() {
  return (
    <Table aria-label="Loyers">
      <TableHead>
        <tr>
          <TableHeaderCell>Locataire</TableHeaderCell>
          <TableHeaderCell numeric>Montant</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        <TableRow selected>
          <TableCell strong>Koffi Adjovi</TableCell>
          <TableCell numeric>850 €</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table', () => {
  it('contient le défilement horizontal et les éléments positionnés dans son conteneur', () => {
    const { container } = render(<Sample />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('overflow-x-auto');
    expect(wrapper?.className).toContain('relative');
  });

  it('rend des en-têtes de colonne et marque la ligne sélectionnée', () => {
    render(<Sample />);
    expect(screen.getByRole('columnheader', { name: 'Montant' }).className).toContain('text-right');
    const row = screen.getByRole('row', { name: /Koffi Adjovi/ });
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(within(row).getByRole('cell', { name: '850 €' }).className).toContain('tabular-nums');
  });

  it('donne aux liens de cellule une zone cliquable d’au moins 24 px', () => {
    render(
      <Table aria-label="Baux">
        <TableBody>
          <TableRow>
            <TableCell>
              <a href="/baux/1">Bail 1</a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole('link', { name: 'Bail 1' }).closest('td');
    expect(cell?.className).toContain('[&_a]:min-h-6');
    expect(cell?.className).toContain('[&_a]:py-1.5');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Sample />);
    await expectNoA11yViolations(container);
  });

  it('rend la zone de défilement atteignable au clavier quand un libellé est fourni', () => {
    render(
      <Table aria-label="Loyers" scrollLabel="Loyers, défilement horizontal">
        <TableBody>
          <TableRow>
            <TableCell>Koffi Adjovi</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const region = screen.getByRole('region', { name: 'Loyers, défilement horizontal' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table', { name: 'Loyers' })).toBeTruthy();
  });

  it('ne rend la zone de défilement ni focalisable ni nommée sans libellé', () => {
    const { container } = render(<Sample />);

    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
