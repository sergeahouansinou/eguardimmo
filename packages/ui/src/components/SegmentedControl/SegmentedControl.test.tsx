import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'echeance', label: 'Paiement d’échéance' },
  { value: 'acompte', label: 'Acompte sur loyer' },
  { value: 'autre', label: 'Autre' },
];

function Harness() {
  const [value, setValue] = useState('acompte');
  return <SegmentedControl label="Nature de l’encaissement" options={options} value={value} onValueChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('marque l’option active et change au clic', async () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Acompte sur loyer' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('radio', { name: 'Autre' }));
    expect(screen.getByRole('radio', { name: 'Autre' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Acompte sur loyer' }).getAttribute('aria-checked')).toBe('false');
  });

  it('se parcourt aux flèches du clavier', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'Acompte sur loyer' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Autre' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Paiement d’échéance' }).getAttribute('aria-checked')).toBe('true');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Harness />);
    await expectNoA11yViolations(container);
  });
});
