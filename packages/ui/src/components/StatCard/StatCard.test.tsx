import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('nomme la section par son libellé et affiche la valeur', () => {
    render(
      <StatCard label="Impayés" value="1 120 €" icon={Wallet} tone="danger">
        <span>3 locataires</span>
      </StatCard>,
    );
    const card = screen.getByRole('region', { name: 'Impayés' });
    expect(card.textContent).toContain('3 locataires');
    expect(screen.getByText('1 120 €').className).toContain('text-fg-danger');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<StatCard label="Taux d'occupation" value="91 %" />);
    await expectNoA11yViolations(container);
  });
});
