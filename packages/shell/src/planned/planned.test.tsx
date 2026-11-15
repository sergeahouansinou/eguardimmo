import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { PlannedScreen } from './PlannedScreen';
import { plannedStaticParams, resolvePlanned } from './planned';

const screens = new Map([
  ['/biens', 'Biens'],
  ['/finances/impayes', 'Impayés'],
]);

describe('resolvePlanned', () => {
  it('retrouve le titre d’un écran prévu', () => {
    expect(resolvePlanned(screens, ['finances', 'impayes'])).toBe('Impayés');
  });

  it('renvoie undefined pour un écran inconnu', () => {
    expect(resolvePlanned(screens, ['inconnu'])).toBeUndefined();
  });
});

describe('plannedStaticParams', () => {
  it('découpe chaque chemin en segments', () => {
    expect(plannedStaticParams(screens)).toEqual([{ ecran: ['biens'] }, { ecran: ['finances', 'impayes'] }]);
  });
});

describe('PlannedScreen', () => {
  it('affiche le titre et l’alerte « Écran prévu »', async () => {
    const { container } = render(<PlannedScreen title="Impayés" description="Page de la maquette du test." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Impayés' })).toBeTruthy();
    expect(screen.getByText('Écran prévu dans un prochain lot')).toBeTruthy();
    expect(screen.getByText('Page de la maquette du test.')).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
