import type { ReactNode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { renderWithSource, TestLink } from '../../../../test/render';
import { dismissFlash, FlashAlert } from '../kit';
import { ApercuRapportPage } from './ApercuRapportPage';
import { REPORT_TYPES, findReport } from './catalog';
import { RapportLoyersPage } from './RapportLoyersPage';
import { RapportsPage } from './RapportsPage';
import { RapportsSourceProvider, createDemoRapportsSource, resetRapportsSource } from './source';
import type { RapportsSource } from './source';

const navigate = vi.fn();
const print = vi.fn();
const downloads: string[] = [];
const createObjectURL = vi.fn((blob: Blob) => {
  downloads.push(String(blob.size));
  return 'blob:test';
});

const normalize = (text: string | null): string => (text ?? '').replace(/[  ]/g, ' ');

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément ${String(index)} introuvable`);
  return item;
}

beforeEach(() => {
  resetRapportsSource();
  dismissFlash();
  navigate.mockClear();
  print.mockClear();
  createObjectURL.mockClear();
  downloads.length = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  vi.stubGlobal('print', print);
  HTMLAnchorElement.prototype.click = vi.fn();
});

const withSource = (source: RapportsSource | undefined, ui: ReactNode) =>
  renderWithSource(
    <>
      <FlashAlert />
      {source ? <RapportsSourceProvider source={source}>{ui}</RapportsSourceProvider> : ui}
    </>,
  );

describe('catalogue', () => {
  it('liste 17 types de rapport avec des slugs uniques', () => {
    expect(REPORT_TYPES).toHaveLength(17);
    expect(new Set(REPORT_TYPES.map((report) => report.slug)).size).toBe(17);
    expect(findReport('loyers-encaisses')?.label).toBe('Loyers encaissés');
    expect(findReport('inconnu')).toBeUndefined();
  });
});

describe('Rapports', () => {
  const open = async (source?: RapportsSource) => {
    const view = withSource(source, <RapportsPage Link={TestLink} navigate={navigate} />);
    await screen.findByRole('heading', { name: 'Derniers rapports générés' });
    return view;
  };

  it('affiche chargement, groupes, cartes liées et historique sans violation d’accessibilité', async () => {
    const view = withSource(undefined, <RapportsPage Link={TestLink} navigate={navigate} />);
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeTruthy();
    await screen.findByRole('heading', { name: 'Derniers rapports générés' });
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(5);
    const link = screen.getByRole('link', { name: /Loyers encaissés/ });
    expect(link.getAttribute('href')).toBe('/rapports/loyers-encaisses');
    expect(screen.getAllByRole('link').filter((item) => item.getAttribute('href')?.startsWith('/rapports/'))).toHaveLength(17);
    const table = screen.getByRole('table', { name: 'Derniers rapports générés' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    await expectNoA11yViolations(view.container);
  });

  it('propose de réessayer après une erreur de chargement', async () => {
    const base = createDemoRapportsSource();
    let calls = 0;
    const source: RapportsSource = { ...base, loadOverview: () => (++calls === 1 ? Promise.reject(new Error('panne')) : base.loadOverview()) };
    withSource(source, <RapportsPage Link={TestLink} navigate={navigate} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('heading', { name: 'Derniers rapports générés' });
  });

  it('filtre par recherche puis affiche un état vide réinitialisable', async () => {
    await open();
    const search = screen.getByRole('searchbox', { name: 'Chercher un rapport' });
    await userEvent.type(search, 'impay');
    expect(screen.getByRole('link', { name: /Loyers impayés/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Loyers appelés/ })).toBeNull();
    await userEvent.clear(search);
    await userEvent.type(search, 'zzzz');
    expect(await screen.findByText('Aucun rapport trouvé')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser la recherche' }));
    expect(screen.getByRole('link', { name: /Loyers appelés/ })).toBeTruthy();
  });

  it('filtre les favoris et la fiscalité', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Favoris' }));
    const links = screen.getAllByRole('link').filter((item) => item.getAttribute('href')?.startsWith('/rapports/'));
    expect(links).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Fiscalité' }));
    expect(screen.getByRole('link', { name: /Revenus fonciers/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Loyers encaissés/ })).toBeNull();
  });

  it('ajoute puis retire un favori', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris : Loyers appelés' }));
    expect(await screen.findByRole('button', { name: 'Retirer des favoris : Loyers appelés' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer des favoris : Loyers appelés' }));
    expect(await screen.findByRole('button', { name: 'Ajouter aux favoris : Loyers appelés' })).toBeTruthy();
  });

  it('liste les envois programmés et en supprime un après confirmation', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Envois programmés' }));
    const dialog = await screen.findByRole('dialog', { name: 'Envois programmés' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(within(dialog).getByRole('button', { name: /Supprimer l’envoi de Export comptable/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer l’envoi' }));
    await waitFor(() => { expect(within(screen.getByRole('dialog', { name: 'Envois programmés' })).getAllByRole('listitem')).toHaveLength(1); });
    expect((await screen.findAllByText('Envoi programmé supprimé.')).length).toBeGreaterThan(0);
  });

  it('ouvre l’aperçu d’un PDF et télécharge un CSV de l’historique', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: /Aperçu PDF/ }));
    expect(navigate).toHaveBeenCalledWith('/rapports/loyers-encaisses/apercu');
    await userEvent.click(screen.getByRole('button', { name: /Télécharger Export comptable/ }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('Loyers encaissés', () => {
  const open = async (search = '', source?: RapportsSource) => {
    const view = withSource(source, <RapportLoyersPage Link={TestLink} navigate={navigate} search={search} />);
    await screen.findByRole('table', { name: /Détail des loyers/ });
    return view;
  };
  const kpi = (label: string): string => normalize(screen.getByRole('region', { name: label }).textContent);
  const pick = async (name: RegExp, option: string) => {
    await userEvent.click(screen.getByRole('combobox', { name }));
    await userEvent.click(await screen.findByRole('option', { name: option }));
  };

  it('reproduit les chiffres de la maquette calculés par lot et par mois', async () => {
    const view = await open();
    expect(kpi('Loyers appelés')).toContain('52 340 €');
    expect(kpi('Loyers encaissés')).toContain('51 270 €');
    expect(kpi('Taux d’encaissement')).toContain('98,0 %');
    expect(kpi('Reste dû')).toContain('1 120 €');
    expect(kpi('Reste dû')).toContain('dont 50 € de trop perçu à déduire');
    const table = screen.getByRole('table', { name: /Détail des loyers/ });
    const rowOf = (name: string) => normalize(within(table).getByText(name).closest('tr')?.textContent ?? null);
    expect(rowOf('Les Tilleuls')).toContain('31 460 €30 400 €1 060 €');
    expect(rowOf('Apt A1')).toContain('Koffi Adjovi119 350 €8 500 €850 €');
    expect(rowOf('Villa RDC')).toContain('612 300 €12 350 €−50 €');
    expect(rowOf('Total')).toContain('52 340 €51 270 €1 070 €');
    expect(screen.getByText('5 lots, 3 immeubles')).toBeTruthy();
    await expectNoA11yViolations(view.container);
  });

  it('recalcule selon la période, le bien et le regroupement', async () => {
    await open();
    await pick(/Bien/, 'Bien : Apt A1');
    await waitFor(() => { expect(kpi('Loyers appelés')).toContain('9 350 €'); });
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await pick(/Regroupement/, 'Regrouper par : Aucun');
    const table = screen.getByRole('table', { name: /Détail des loyers/ });
    await waitFor(() => { expect(within(table).queryByText('Les Tilleuls')).toBeNull(); });
    await pick(/Période/, 'Novembre 2026 : 01/11/2026 → 30/11/2026');
    await waitFor(() => { expect(kpi('Loyers appelés')).toContain('5 690 €'); });
  });

  it('affiche un état vide sur une période sans avis puis réinitialise', async () => {
    await open();
    await pick(/Période/, 'Année 2025 : 01/01/2025 → 31/12/2025');
    expect(await screen.findByText('Aucun loyer sur cette période')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    await screen.findByRole('table', { name: /Détail des loyers/ });
  });

  it('exporte un CSV et ouvre l’aperçu avec les filtres dans l’adresse', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en Excel' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Aperçu PDF' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/loyers-encaisses/apercu?periode=year2026&bien=all&locataire=all&groupe=building');
  });

  it('relit les filtres de l’adresse', async () => {
    await open('periode=last3&bien=apt-a2&locataire=all&groupe=none');
    expect(kpi('Loyers appelés')).toContain('2 970 €');
  });

  it('programme un envoi après validation Zod', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Programmer l’envoi' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'pas-un-email');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Programmer l’envoi' }));
    expect(await within(dialog).findByText(/Adresse e-mail invalide/)).toBeTruthy();
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Destinataire' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'compta@exemple.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Programmer l’envoi' }));
    expect((await screen.findAllByText(/Envoi programmé : Loyers encaissés à compta@exemple.com/)).length).toBeGreaterThan(0);
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('propose de réessayer après une erreur de chargement', async () => {
    const base = createDemoRapportsSource();
    let calls = 0;
    const source: RapportsSource = { ...base, loadLoyers: () => (++calls === 1 ? Promise.reject(new Error('panne')) : base.loadLoyers()) };
    withSource(source, <RapportLoyersPage Link={TestLink} navigate={navigate} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('table', { name: /Détail des loyers/ });
  });
});

describe('Aperçu du rapport', () => {
  const open = async (search = '') => {
    const view = withSource(undefined, <ApercuRapportPage Link={TestLink} navigate={navigate} search={search} />);
    await screen.findByRole('toolbar', { name: 'Outils de l’aperçu' });
    return view;
  };

  it('affiche la feuille A4 avec les totaux, le panneau de paramètres et le contenu', async () => {
    const view = await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Loyers encaissés 2026' })).toBeTruthy();
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();
    const paper = screen.getByRole('table', { name: 'Loyers par bien' });
    expect(normalize(paper.textContent)).toContain('52 340 €51 270 €1 070 €');
    expect(normalize(screen.getByLabelText('Page 1 sur 2').textContent)).toContain('52 340,00 €');
    expect(normalize(screen.getByLabelText('Page 1 sur 2').textContent)).toContain('Reste dû net du trop perçu de Marc Dossou (50 €)');
    const content = screen.getByRole('region', { name: 'Contenu' });
    expect(normalize(content.textContent)).toContain('Pages2');
    expect(normalize(content.textContent)).toContain('Lots5');
    expect(normalize(content.textContent)).toContain('Paiements49');
    await expectNoA11yViolations(view.container);
  });

  it('change de page, retire l’annexe et recompte les pages', async () => {
    await open();
    expect(screen.getByLabelText('Page 2 sur 2').className).toContain('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
    expect(screen.getByLabelText('Page 2 sur 2').className).not.toContain('hidden');
    expect(screen.getByLabelText('Page 1 sur 2').className).toContain('hidden');
    await userEvent.click(screen.getByRole('switch', { name: 'Détail mensuel en annexe' }));
    expect(screen.getByText('Page 1 / 1')).toBeTruthy();
    expect(screen.queryByLabelText('Page 2 sur 1')).toBeNull();
  });

  it('masque les lignes à zéro', async () => {
    await open();
    const paper = screen.getByRole('table', { name: 'Loyers par bien' });
    expect(within(paper).getByText('Apt A2')).toBeTruthy();
    await userEvent.click(screen.getByRole('switch', { name: 'Masquer les lignes à zéro' }));
    expect(within(paper).queryByText('Apt A2')).toBeNull();
  });

  it('zoome et ajuste la feuille', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Agrandir' }));
    expect(screen.getByText('110 %')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    await userEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    expect(screen.getByText('90 %')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ajuster' }));
    expect(screen.getByText('100 %')).toBeTruthy();
  });

  it('imprime depuis les trois commandes de téléchargement et d’impression', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer' }));
    for (const button of screen.getAllByRole('button', { name: 'Télécharger le PDF' })) await userEvent.click(button);
    expect(print).toHaveBeenCalledTimes(3);
  });

  it('exporte un CSV et revient modifier les paramètres', async () => {
    await open('periode=last3');
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en Excel' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/loyers-encaisses?periode=last3&bien=all&locataire=all&groupe=building');
  });

  it('envoie par e-mail après validation Zod', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer par e-mail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Envoyer par e-mail' });
    expect(within(dialog).getByRole('textbox', { name: 'Objet' })).toHaveProperty('value', 'Loyers encaissés 2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect(await within(dialog).findByText('Saisissez une adresse e-mail.')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'marc@exemple.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect((await screen.findAllByText(/Rapport envoyé à marc@exemple.com/)).length).toBeGreaterThan(0);
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('affiche un état vide quand les paramètres ne donnent aucune donnée', async () => {
    withSource(undefined, <ApercuRapportPage Link={TestLink} navigate={navigate} search="periode=year2025" />);
    expect(await screen.findByText('Aucune donnée à afficher')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier les paramètres' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/loyers-encaisses');
  });

  it('indique l’erreur de chargement', async () => {
    const base = createDemoRapportsSource();
    const source: RapportsSource = { ...base, loadLoyers: () => Promise.reject(new Error('panne')) };
    withSource(source, <ApercuRapportPage Link={TestLink} navigate={navigate} />);
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
    expect(nth(screen.getAllByRole('alert'), 0)).toBeTruthy();
  });
});
