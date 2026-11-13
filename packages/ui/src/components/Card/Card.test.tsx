import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('compose en-tête, titre et contenu', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Loyers du mois</CardTitle>
        </CardHeader>
        <CardContent>12 quittances émises</CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Loyers du mois' })).toBeTruthy();
    expect(screen.getByText('12 quittances émises')).toBeTruthy();
  });

  it('applique surface, bordure et rayon des jetons sans ombre', () => {
    render(<Card data-testid="card">Contenu</Card>);
    const className = screen.getByTestId('card').className;
    expect(className).toContain('bg-surface');
    expect(className).toContain('border-line');
    expect(className).toContain('rounded-lg');
    expect(className).toContain('p-4');
    expect(className).not.toContain('shadow');
  });

  it('permet de choisir le niveau de titre', () => {
    render(<CardTitle as="h2">Titre</CardTitle>);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('fusionne className', () => {
    render(
      <Card data-testid="card" className="w-80">
        Contenu
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('w-80');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Loyers du mois</CardTitle>
        </CardHeader>
        <CardContent>12 quittances émises</CardContent>
      </Card>,
    );
    await expectNoA11yViolations(container);
  });
});
