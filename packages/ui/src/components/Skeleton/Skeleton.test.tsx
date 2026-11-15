import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('est masqué aux lecteurs d’écran et pulse', () => {
    const { container } = render(<Skeleton className="w-1/2" />);
    const node = container.firstElementChild;
    expect(node?.getAttribute('aria-hidden')).toBe('true');
    expect(node?.className).toContain('animate-pulse');
    expect(node?.className).toContain('w-1/2');
  });

  it.each([
    ['line', 'h-3'],
    ['block', 'rounded-lg'],
    ['circle', 'rounded-full'],
  ] as const)('applique la forme %s', (shape, expected) => {
    const { container } = render(<Skeleton shape={shape} />);
    expect(container.firstElementChild?.className).toContain(expected);
  });
});
