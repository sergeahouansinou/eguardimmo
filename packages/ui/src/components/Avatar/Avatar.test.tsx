import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('affiche deux initiales en majuscules, masquées par défaut', () => {
    const { container } = render(<Avatar initials="mcx" />);
    const avatar = container.firstElementChild;
    expect(avatar?.textContent).toBe('MC');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
  });

  it('expose un libellé quand il est fourni', () => {
    render(<Avatar initials="MC" label="Marc Chevalier" size="lg" />);
    const avatar = screen.getByRole('img', { name: 'Marc Chevalier' });
    expect(avatar.className).toContain('size-10');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<Avatar initials="MC" label="Marc Chevalier" />);
    await expectNoA11yViolations(container);
  });
});
