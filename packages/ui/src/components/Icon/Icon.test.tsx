import { render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Icon } from './Icon';

describe('Icon', () => {
  it('est décorative par défaut (aria-hidden)', () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('applique 16px et un trait de 1.75 par défaut', () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('stroke-width')).toBe('1.75');
  });

  it.each([14, 20, 32] as const)('accepte la taille %i', (size) => {
    const { container } = render(<Icon icon={Check} size={size} />);
    expect(container.querySelector('svg')?.getAttribute('height')).toBe(String(size));
  });

  it('devient une image accessible avec un libellé', () => {
    render(<Icon icon={Check} label="Validé" />);
    const img = screen.getByRole('img', { name: 'Validé' });
    expect(img.hasAttribute('aria-hidden')).toBe(false);
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(
      <div>
        <Icon icon={Check} />
        <Icon icon={Check} label="Validé" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
