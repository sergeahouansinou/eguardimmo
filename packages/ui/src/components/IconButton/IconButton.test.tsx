import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('expose son label en aria-label, sans attribut title', () => {
    render(<IconButton label="Supprimer le bien" icon={Trash2} />);
    const button = screen.getByRole('button', { name: 'Supprimer le bien' });
    expect(button.getAttribute('aria-label')).toBe('Supprimer le bien');
    expect(button.hasAttribute('title')).toBe(false);
    expect(button.getAttribute('type')).toBe('button');
  });

  it('affiche le tooltip au focus clavier', async () => {
    render(<IconButton label="Supprimer le bien" icon={Trash2} />);
    await userEvent.tab();
    expect((await screen.findByRole('tooltip')).textContent).toBe('Supprimer le bien');
  });

  it('affiche le tooltip au survol', async () => {
    render(<IconButton label="Supprimer le bien" icon={Trash2} />);
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByRole('tooltip', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('la taille lg offre une cible de 44 px', () => {
    render(<IconButton label="Ajouter aux favoris" icon={Trash2} size="lg" />);
    expect(screen.getByRole('button').className).toContain('size-11');
  });

  it('déclenche onClick', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Supprimer" icon={Trash2} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applique taille et variante', () => {
    render(<IconButton label="Supprimer" icon={Trash2} size="xs" variant="danger" />);
    const className = screen.getByRole('button').className;
    expect(className).toContain('size-6');
    expect(className).toContain('text-fg-danger');
  });

  it('masque l’icône aux technologies d’assistance', () => {
    const { container } = render(<IconButton label="Supprimer" icon={Trash2} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<IconButton label="Supprimer le bien" icon={Trash2} />);
    await expectNoA11yViolations(container);
  });
});
