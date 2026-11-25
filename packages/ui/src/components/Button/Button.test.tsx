import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Button } from './Button';

describe('Button', () => {
  it('rend un bouton de type button par défaut avec son libellé', () => {
    render(<Button>Enregistrer</Button>);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('autorise type submit', () => {
    render(<Button type="submit">Envoyer</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('déclenche onClick au clic', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applique la variante et la taille', () => {
    render(
      <Button variant="danger" size="lg">
        Supprimer
      </Button>,
    );
    const className = screen.getByRole('button').className;
    expect(className).toContain('bg-danger-solid');
    expect(className).toContain('h-10');
  });

  it('la variante accent utilise le rôle accent', () => {
    render(<Button variant="accent">Rechercher</Button>);
    const className = screen.getByRole('button').className;
    expect(className).toContain('bg-accent');
    expect(className).toContain('text-on-accent');
  });

  it('en chargement : aria-busy, spinner et clic bloqué', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoi
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Envoi' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled bloque le clic', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Valider
      </Button>,
    );
    const button = screen.getByRole<HTMLButtonElement>('button');
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('asChild rend un lien sans attribut type', () => {
    render(
      <Button asChild variant="link">
        <a href="/baux">Voir les baux</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Voir les baux' });
    expect(link.getAttribute('href')).toBe('/baux');
    expect(link.hasAttribute('type')).toBe(false);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('asChild en chargement ajoute le spinner et bloque le clic', async () => {
    const onClick = vi.fn();
    render(
      <Button asChild loading onClick={onClick}>
        <a href="/baux">Voir</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Voir' });
    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.querySelector('.animate-spin')).not.toBeNull();
    await userEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('transmet la ref', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <div>
        <Button>Primaire</Button>
        <Button variant="secondary" loading>
          Chargement
        </Button>
        <Button asChild variant="link">
          <a href="/baux">Lien</a>
        </Button>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
