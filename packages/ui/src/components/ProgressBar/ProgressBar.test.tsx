import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('expose sa valeur par son libellé et dimensionne la jauge', () => {
    render(<ProgressBar value={79} label="79 % encaissé" />);
    const bar = screen.getByRole('img', { name: '79 % encaissé' });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('79%');
  });

  it.each([
    [-5, '0%'],
    [140, '100%'],
  ])('borne la valeur %s à %s', (value, expected) => {
    render(<ProgressBar value={value} label="Jauge" />);
    const bar = screen.getByRole('img', { name: 'Jauge' });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe(expected);
  });

  it('n’a aucune violation axe', async () => {
    const { container } = render(<ProgressBar value={50} label="50 %" />);
    await expectNoA11yViolations(container);
  });
});
