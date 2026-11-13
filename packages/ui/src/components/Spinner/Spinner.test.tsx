import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('expose role status avec le libellé par défaut', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').textContent).toBe('Chargement');
  });

  it('accepte un libellé personnalisé', () => {
    render(<Spinner label="Envoi du bail" />);
    expect(screen.getByRole('status').textContent).toBe('Envoi du bail');
  });

  it('applique la taille demandée', () => {
    const { container } = render(<Spinner size={32} />);
    expect(container.querySelector('.size-8')).not.toBeNull();
  });

  it('est masqué aux technologies d’assistance en mode décoratif', () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Spinner />);
    await expectNoA11yViolations(container);
  });
});
