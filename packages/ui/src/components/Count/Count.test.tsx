import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Count } from './Count';

describe('Count', () => {
  it.each([
    ['neutral', 'bg-muted'],
    ['active', 'bg-action'],
    ['accent', 'bg-accent'],
  ] as const)('applique le ton %s', (tone, expected) => {
    render(<Count value={7} tone={tone} />);
    expect(screen.getByText('7').className).toContain(expected);
  });
});
