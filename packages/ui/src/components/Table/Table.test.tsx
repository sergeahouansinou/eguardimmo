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

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Sample />);
    await expectNoA11yViolations(container);
  });
});
