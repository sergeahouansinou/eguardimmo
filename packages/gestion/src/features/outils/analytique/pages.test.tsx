import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { renderWithSource, TestLink } from '../../../../test/render';
import { dismissFlash, FlashAlert } from '../kit';
import { AnalytiqueOccPage } from './AnalytiqueOccPage';
import { AnalytiquePrevPage } from './AnalytiquePrevPage';
import { AnalytiqueRentaPage } from './AnalytiqueRentaPage';
import { AnalytiqueRevDepPage } from './AnalytiqueRevDepPage';
import { AnalytiqueVuePage } from './AnalytiqueVuePage';
import { AnalytiqueSourceProvider, createDemoAnalytiqueSource, resetAnalytiqueSource } from './source';
import type { AnalytiqueSource } from './source';

const navigate = vi.fn();

const pages = {
  vue: AnalytiqueVuePage,
  revdep: AnalytiqueRevDepPage,
  prev: AnalytiquePrevPage,
  occ: AnalytiqueOccPage,
  renta: AnalytiqueRentaPage,
};

type PageKey = keyof typeof pages;

async function open(key: PageKey, source?: AnalytiqueSource) {
  const Page = pages[key];
  const ui = (
    <>
      <FlashAlert />
      <Page Link={TestLink} navigate={navigate} />
    </>
  );
  const view = renderWithSource(source ? <AnalytiqueSourceProvider source={source}>{ui}</AnalytiqueSourceProvider> : ui);
  await screen.findByText(/Données au 13\/11\/2026/);
  return view;
}

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément ${String(index)} introuvable`);
  return item;
}

const kpi = (label: string): string => screen.getByRole('region', { name: label }).textContent.replace(/[\u00a0\u202f]/g, ' ');

async function pick(name: RegExp, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

const downloads: string[] = [];
const createObjectURL = vi.fn((blob: Blob) => {
  downloads.push(String(blob.size));
  return 'blob:test';
});

beforeEach(() => {
  resetAnalytiqueSource();
  dismissFlash();
  downloads.length = 0;
  createObjectURL.mockClear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  HTMLAnchorElement.prototype.click = vi.fn();
});

describe.each(Object.keys(pages) as PageKey[])('états communs (%s)', (key) => {
  it('affiche le chargement puis les données, sans violation d’accessibilité', async () => {
    const view = renderWithSource(<>{(() => { const Page = pages[key]; return <Page Link={TestLink} navigate={navigate} />; })()}</>);
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeTruthy();
    await screen.findByText(/Données au 13\/11\/2026/);
    await expectNoA11yViolations(view.container);
  });

  it('propose de réessayer quand le chargement échoue', async () => {
    const base = createDemoAnalytiqueSource();
    let calls = 0;
    const source: AnalytiqueSource = {
      ...base,
      load: () => (++calls === 1 ? Promise.reject(new Error('panne')) : base.load()),
    };
    const Page = pages[key];
    renderWithSource(
      <AnalytiqueSourceProvider source={source}>
        <Page Link={TestLink} navigate={navigate} />
      </AnalytiqueSourceProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByText(/Données au 13\/11\/2026/);
  });

  it('exporte un CSV réel depuis le bouton Exporter', async () => {
    await open(key);
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(1);
  });

  it('confirme l’actualisation des données', async () => {
    await open(key);
    await userEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect((await screen.findAllByText(/actualisées/i)).length).toBeGreaterThan(0);
  });
});

describe('Vue d’ensemble', () => {
  it('affiche les chiffres de la maquette calculés depuis les données', async () => {
    await open('vue');
    expect(kpi('Revenus encaissés')).toContain('56 560 €');
    expect(kpi('Dépenses')).toContain('17 370 €');
    expect(kpi('Cash-flow net')).toContain('39 190 €');
    expect(kpi('Occupation moyenne')).toContain('96 %');
    expect(screen.getAllByText('Charges de copropriété').length).toBeGreaterThan(0);
  });

  it('recalcule les KPI quand l’immeuble change', async () => {
    await open('vue');
    await pick(/Immeuble/, 'Immeuble : Maison Rivière');
    await waitFor(() => { expect(kpi('Revenus encaissés')).toContain('15 360 €'); });
    expect(kpi('Revenus encaissés')).not.toContain('56 560');
  });

  it('filtre la page au clic sur un immeuble du classement', async () => {
    await open('vue');
    await userEvent.click(screen.getByRole('button', { name: /Les Tilleuls/ }));
    await waitFor(() => { expect(screen.getByRole('combobox', { name: /Immeuble/ }).textContent).toContain('Les Tilleuls'); });
    expect(kpi('Revenus encaissés')).toContain('27 140 €');
  });

  it('change de période et réinitialise', async () => {
    await open('vue');
    await userEvent.click(screen.getByRole('radio', { name: '3 mois' }));
    await waitFor(() => { expect(kpi('Revenus encaissés')).not.toContain('56 560'); });
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => { expect(kpi('Revenus encaissés')).toContain('56 560 €'); });
  });

  it('retire les comparaisons quand « Comparer à N-1 » est désactivé', async () => {
    await open('vue');
    const compare = screen.getByRole('switch', { name: 'Comparer à N-1' });
    expect(screen.getAllByText('vs N-1').length).toBeGreaterThan(0);
    await userEvent.click(compare);
    expect(screen.queryAllByText('vs N-1')).toHaveLength(0);
  });

  it('agrandit un visuel dans un dialogue', async () => {
    await open('vue');
    await userEvent.click(nth(screen.getAllByRole('button', { name: 'Agrandir le visuel' }), 0));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Revenus et dépenses par mois')).toBeTruthy();
  });

  it('masque le tableau de données via les options du visuel et exporte en CSV', async () => {
    await open('vue');
    const menu = nth(screen.getAllByRole('button', { name: 'Options du visuel' }), 0);
    await userEvent.click(menu);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Exporter en CSV' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await userEvent.click(nth(screen.getAllByRole('button', { name: 'Options du visuel' }), 0));
    const table = (): HTMLElement => screen.getByRole('table', { name: 'Données : Revenus et dépenses par mois', hidden: true });
    expect(table().className).toContain('sr-only');
    await userEvent.click(await screen.findByRole('menuitem', { name: /Afficher le tableau de données/ }));
    expect(table().className).not.toContain('sr-only');
  });

  it('navigue au clavier dans le graphique', async () => {
    await open('vue');
    const slider = nth(screen.getAllByRole('slider'), 0);
    slider.focus();
    const before = slider.getAttribute('aria-valuenow');
    await userEvent.keyboard('{ArrowLeft}');
    expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
  });

  it('affiche un état vide quand aucun lot ne correspond aux filtres', async () => {
    await open('vue');
    await pick(/Immeuble/, 'Immeuble : Maison Rivière');
    await pick(/Type de bien/, 'Type de bien : Cave');
    expect(await screen.findByText('Aucune donnée pour ces filtres')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    await waitFor(() => { expect(kpi('Revenus encaissés')).toContain('56 560 €'); });
  });
});

describe('Revenus et dépenses', () => {
  it('affiche revenus, dépenses, résultat et taux de charges', async () => {
    await open('revdep');
    expect(kpi('Revenu brut')).toContain('56 560 €');
    expect(kpi('Dépenses')).toContain('17 370 €');
    expect(kpi('Résultat net')).toContain('39 190 €');
    expect(kpi('Taux de charges')).toContain('30,7 %');
    expect(screen.getByText(/Provisions en trop : 2\s040\s€ à reverser/)).toBeTruthy();
  });

  it('affiche la carte de chaleur des dépenses par catégorie', async () => {
    await open('revdep');
    const grid = screen.getByRole('table', { name: /Dépenses par catégorie et par mois/ });
    expect(within(grid).getByText('Taxe foncière')).toBeTruthy();
    expect(within(grid).getByText(/4\s860/)).toBeTruthy();
  });

  it('retire la comparaison N-1 à la désactivation du commutateur', async () => {
    await open('revdep');
    await userEvent.click(screen.getByRole('switch', { name: 'Comparer à N-1' }));
    expect(screen.queryByText(/N-1 : 54\s350/)).toBeNull();
  });
});

describe('Prévisionnel', () => {
  it('projette les encaissements et la trésorerie finale', async () => {
    await open('prev');
    expect(kpi('Encaissements projetés')).toContain('59 240 €');
    expect(kpi('Décaissements projetés')).toContain('23 670 €');
    expect(kpi('Solde net projeté')).toContain('+35 570 €');
    expect(screen.getByText(/43\s770\s€/)).toBeTruthy();
  });

  it('change d’horizon', async () => {
    await open('prev');
    await userEvent.click(screen.getByRole('radio', { name: '6 mois' }));
    await waitFor(() => { expect(kpi('Encaissements projetés')).not.toContain('59 240 €'); });
  });

  it('refuse des hypothèses invalides puis enregistre des hypothèses valides', async () => {
    await open('prev');
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const dialog = await screen.findByRole('dialog');
    const irl = within(dialog).getByRole('textbox', { name: /Indexation IRL/ });
    await userEvent.clear(irl);
    await userEvent.type(irl, 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByText(/format attendu/)).toBeTruthy();
    await userEvent.clear(irl);
    await userEvent.type(irl, '2,5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findAllByText('Hypothèses du prévisionnel mises à jour.')).length).toBeGreaterThan(0);
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(await screen.findByText(/Indexation IRL, \+2[,.]5/)).toBeTruthy();
  });
});

describe('Occupation', () => {
  it('affiche l’occupation actuelle, la vacance et les fins de bail', async () => {
    await open('occ');
    expect(kpi('Occupation actuelle')).toContain('91 %');
    expect(kpi('Vacance cumulée')).toContain('5 mois');
    expect(kpi('Vacance cumulée')).toContain('152 jours');
    expect(screen.getByText('Préavis reçu')).toBeTruthy();
    expect(screen.getByRole('grid', { name: "Planning d'occupation" })).toBeTruthy();
  });

  it('réduit le planning au lot d’un immeuble', async () => {
    await open('occ');
    await pick(/Immeuble/, 'Immeuble : Maison Rivière');
    const grid = screen.getByRole('grid', { name: "Planning d'occupation" });
    await waitFor(() => { expect(within(grid).queryByText('Apt A1')).toBeNull(); });
    expect(within(grid).getByText('Villa RDC')).toBeTruthy();
  });
});

describe('Rentabilité', () => {
  it('affiche rendements et totaux de la maquette', async () => {
    await open('renta');
    expect(kpi('Rendement brut')).toContain('6,2 %');
    expect(kpi('Rendement net')).toContain('4,5 %');
    expect(kpi('Lot le moins rentable')).toContain('Studio 1er');
    const table = screen.getByRole('table', { name: /Détail de la rentabilité/ });
    expect(within(table).getByText('11 lots')).toBeTruthy();
  });

  it('trie le tableau par colonne', async () => {
    await open('renta');
    const table = screen.getByRole('table', { name: /Détail de la rentabilité/ });
    await userEvent.click(within(table).getByRole('button', { name: /Prix de revient/ }));
    const firstRow = nth(within(table).getAllByRole('row'), 1);
    expect(within(firstRow).getByText('Villa RDC')).toBeTruthy();
  });

  it('retire les comparaisons pour l’année 2025', async () => {
    await open('renta');
    await userEvent.click(screen.getByRole('radio', { name: 'Année 2025' }));
    await waitFor(() => { expect(kpi('Rendement brut')).not.toMatch(/pt/); });
    expect(kpi('Rendement brut')).toMatch(/%/);
  });
});
