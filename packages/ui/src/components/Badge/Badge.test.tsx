import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('affiche son contenu avec le ton neutre par défaut', () => {
    render(<Badge>Brouillon</Badge>);
    const badge = screen.getByText('Brouillon');
    expect(badge.className).toContain('bg-muted');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('h-5');
  });

  it.each([
    ['info', 'bg-info'],
    ['success', 'bg-success'],
    ['warning', 'bg-warning'],
    ['danger', 'bg-danger'],
  ] as const)('applique le ton %s', (tone, expected) => {
    render(<Badge tone={tone}>État</Badge>);
    expect(screen.getByText('État').className).toContain(expected);
  });

  it('reste sur une ligne de 20 px par défaut, et se coupe sur plusieurs lignes avec wrap', () => {
    render(
      <>
        <Badge>Court</Badge>
        <Badge wrap>Mandat MANDAT-2026-TRES-LONGUE-REFERENCE-SANS-ESPACE</Badge>
      </>,
    );
    expect(screen.getByText('Court').className).toContain('whitespace-nowrap');
    const wrapped = screen.getByText(/Mandat MANDAT-2026/);
    expect(wrapped.className).toContain('[overflow-wrap:anywhere]');
    expect(wrapped.className).toContain('max-w-full');
    expect(wrapped.className).not.toContain('whitespace-nowrap');
    expect(wrapped.className).not.toMatch(/(^| )h-5( |$)/);
  });

  it('transmet les attributs natifs', () => {
    render(<Badge data-testid="badge">Payé</Badge>);
    expect(screen.getByTestId('badge').textContent).toBe('Payé');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <div>
        <Badge>Neutre</Badge>
        <Badge tone="success">Payé</Badge>
        <Badge tone="danger">Impayé</Badge>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
