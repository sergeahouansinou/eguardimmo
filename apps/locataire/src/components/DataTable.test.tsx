import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';

interface Row {
  id: string;
  label: string;
}

describe('DataTable', () => {
  it('rend la zone de défilement atteignable au clavier', () => {
    render(<DataTable<Row> label="Échéances" columns={[{ id: 'label', header: 'Libellé', cell: (row) => row.label }]} rows={[{ id: '1', label: 'Loyer de novembre' }]} rowKey={(row) => row.id} />);

    const region = screen.getByRole('region', { name: 'Échéances, défilement horizontal' });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table', { name: 'Échéances' })).toBeTruthy();
  });
});
