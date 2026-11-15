import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { renderLot } from '../../../test/lots';
import { compareSurveys, countEvolutions, evolutionOf, findEntryFor } from './compareEdl';
import { demoEdls } from './demo';
import { EtatLieuxComparePage } from './EtatLieuxComparePage';

const edl = (id: string) => {
  const found = demoEdls.find((entry) => entry.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('compareEdl', () => {
  it('classe l’évolution d’un élément', () => {
    expect(evolutionOf('bon', 'bon')).toBe('identique');
    expect(evolutionOf('bon', 'degrade')).toBe('degradation');
    expect(evolutionOf('usage', 'neuf')).toBe('amelioration');
    expect(evolutionOf('bon', null)).toBe('non_releve');
    expect(evolutionOf('bon', 'non_controle')).toBe('non_releve');
  });

  it('retrouve l’entrée du même bien, de préférence du même locataire', () => {
    expect(findEntryFor(edl('edl-2026-007'), demoEdls)?.id).toBe('edl-2024-012');
    expect(findEntryFor(edl('edl-2026-005'), demoEdls)).toBeNull();
    expect(findEntryFor(edl('edl-2023-001'), demoEdls)?.id).toBe('edl-2023-002');
  });

  it('compte les dégradations entre l’entrée et la sortie', () => {
    const counts = countEvolutions(compareSurveys(edl('edl-2024-012').survey, edl('edl-2026-007').survey));
    expect(counts.degradation).toBe(2);
    expect(counts.amelioration).toBe(0);
    expect(counts.identique).toBeGreaterThan(5);
  });
});

describe('EtatLieuxComparePage', () => {
  it('affiche les écarts puis tous les éléments', async () => {
    const { container } = renderLot(<EtatLieuxComparePage id="edl-2026-007" />);
    expect(await screen.findByRole('heading', { name: 'Comparer EDL-2026-007 avec l’entrée' })).toBeTruthy();
    const bathroom = screen.getByRole('region', { name: 'Salle de bains' });
    expect(within(bathroom).getByText('Dégradation')).toBeTruthy();
    expect(within(bathroom).getByText(/Traces d’humidité/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Séjour' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Tous les éléments' }));
    expect(screen.getByRole('region', { name: 'Séjour' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('signale l’absence d’état d’entrée', async () => {
    renderLot(<EtatLieuxComparePage id="edl-2026-005" />);
    expect(await screen.findByText('Aucun état des lieux d’entrée trouvé')).toBeTruthy();
  });

  it('refuse de comparer un état d’entrée', async () => {
    renderLot(<EtatLieuxComparePage id="edl-2023-002" />);
    expect(await screen.findByText('Il n’y a rien à comparer')).toBeTruthy();
  });

  it('gère un identifiant inconnu', async () => {
    renderLot(<EtatLieuxComparePage id="inconnu" />);
    expect(await screen.findByText('Cet état des lieux n’existe pas')).toBeTruthy();
  });
});
