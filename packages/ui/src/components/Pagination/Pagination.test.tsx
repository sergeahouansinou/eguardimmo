import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('autorise le retour à la ligne pour tenir dans un conteneur étroit', () => {
    render(<Pagination page={1} pageSize={10} total={25} onPageChange={() => undefined} />);
    expect(screen.getByRole('navigation').className).toContain('flex-wrap');
  });

  it('résume la plage affichée et masque la navigation sur une seule page', () => {
    render(<Pagination page={1} pageSize={10} total={9} onPageChange={() => undefined} />);
    expect(screen.getByText('1 à 9 sur 9')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Suivant/ })).toBeNull();
  });

  it('affiche zéro sans résultat', () => {
    render(<Pagination page={1} pageSize={10} total={0} onPageChange={() => undefined} />);
    expect(screen.getByText('0 à 0 sur 0')).toBeTruthy();
  });

  it('change de page et désactive les bornes', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={10} total={25} onPageChange={onPageChange} />);
    expect(screen.getByText('1 à 10 sur 25')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Précédent/ }).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('désactive Suivant sur la dernière page', () => {
    render(<Pagination page={3} pageSize={10} total={25} onPageChange={() => undefined} />);
    expect(screen.getByText('21 à 25 sur 25')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Suivant/ }).disabled).toBe(true);
  });

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<Pagination page={2} pageSize={10} total={25} onPageChange={() => undefined} />);
    await expectNoA11yViolations(container);
  });
});
