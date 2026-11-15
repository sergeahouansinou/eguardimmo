import type { ReactNode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { renderWithSource, TestLink } from '../../../../test/render';
import { dismissFlash } from '../kit';
import { ApercuReportPage } from './ApercuReportPage';
import { REPORT_TYPES, MODELED_SLUG } from './catalog';
import { RapportPage } from './RapportPage';
import { RapportsSourceProvider, createDemoRapportsSource, resetRapportsSource } from './source';
import type { RapportsSource } from './source';

const navigate = vi.fn();
const print = vi.fn();
const blobs: Blob[] = [];
const createObjectURL = vi.fn((blob: Blob) => {
  blobs.push(blob);
  return 'blob:test';
});

const SLUGS = REPORT_TYPES.filter((report) => report.slug !== MODELED_SLUG).map((report) => report.slug);

beforeEach(() => {
  resetRapportsSource();
  dismissFlash();
  navigate.mockClear();
  print.mockClear();
  createObjectURL.mockClear();
  blobs.length = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  vi.stubGlobal('print', print);
  HTMLAnchorElement.prototype.click = vi.fn();
});

const withSource = (source: RapportsSource | undefined, ui: ReactNode) =>
  renderWithSource(source ? <RapportsSourceProvider source={source}>{ui}</RapportsSourceProvider> : <>{ui}</>);

const page = (slug: string, search = '') => <RapportPage Link={TestLink} navigate={navigate} slug={slug} search={search} />;
const preview = (slug: string, search = '') => <ApercuReportPage Link={TestLink} navigate={navigate} slug={slug} search={search} />;

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('Élément introuvable');
  return item;
}

const label = (slug: string): string => REPORT_TYPES.find((report) => report.slug === slug)?.label ?? slug;

const pick = async (name: RegExp, option: string) => {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
};

describe('page de rapport pilotée par sa définition', () => {
  it.each(SLUGS)('%s : titre, indicateurs, tableau et accessibilité', async (slug) => {
    const view = withSource(undefined, page(slug));
    expect(screen.getByRole('status', { name: 'Chargement du rapport' })).toBeTruthy();
    const table = await screen.findByRole('table');
    expect(screen.getByRole('heading', { level: 1, name: label(slug) })).toBeTruthy();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2);
    expect(screen.getByRole('button', { name: 'Aperçu PDF' })).toBeTruthy();
    await expectNoA11yViolations(view.container);
  });

  it('affiche les chiffres du rapport Loyers impayés, cohérents avec les baux', async () => {
    withSource(undefined, page('loyers-impayes'));
    const table = await screen.findByRole('table');
    const text = (within(table).getByText('Koffi Adjovi').closest('tr')?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ');
    expect(text).toContain('Apt A1');
    expect(text).toContain('850 €');
    expect(text).toContain('01/11/2026');
    const total = (within(table).getByText('Total').closest('tr')?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ');
    expect(total).toContain('1 120 €');
  });

  it('recalcule selon la période et affiche un état vide réinitialisable', async () => {
    withSource(undefined, page('loyers-appeles'));
    await screen.findByRole('table');
    await pick(/Période/, 'Année 2025 : 01/01/2025 → 31/12/2025');
    expect(await screen.findByText('Aucune donnée sur cette période')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    await screen.findByRole('table');
  });

  it('filtre par bien et par regroupement', async () => {
    withSource(undefined, page('loyers-appeles'));
    await screen.findByRole('table');
    await pick(/Bien/, 'Bien : Apt A1');
    await waitFor(() => { expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4); });
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => { expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(14); });
    await pick(/Regroupement/, 'Regrouper par : Aucun');
    await waitFor(() => { expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11); });
  });

  it('relit les filtres de l’adresse', async () => {
    withSource(undefined, page('loyers-appeles', 'periode=month&bien=apt-a2&groupe=none'));
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Nadège Sossou')).toBeTruthy();
  });

  it('exporte un CSV complet puis ouvre l’aperçu avec les filtres dans l’adresse', async () => {
    withSource(undefined, page('depenses-par-bien'));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en Excel' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const text = await first(blobs).text();
    expect(text).toContain('Chaudières Services');
    expect(text).toContain('Total;');
    await userEvent.click(screen.getByRole('button', { name: 'Aperçu PDF' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/depenses-par-bien/apercu?periode=year2026&bien=all&locataire=all&groupe=building');
  });

  it('programme un envoi après validation Zod de l’adresse', async () => {
    withSource(undefined, page('soldes-des-locataires'));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Programmer l’envoi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Programmer l’envoi' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'pas-un-email');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Programmer l’envoi' }));
    expect(await within(dialog).findByText('Adresse e-mail invalide, par exemple nom@exemple.com.')).toBeTruthy();
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Destinataire' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'compta@exemple.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Programmer l’envoi' }));
    expect(await screen.findByText('Envoi programmé : Soldes des locataires à compta@exemple.com.')).toBeTruthy();
  });

  it('propose de réessayer après une erreur de chargement', async () => {
    const base = createDemoRapportsSource();
    let calls = 0;
    const source: RapportsSource = { ...base, loadReportsData: () => (++calls === 1 ? Promise.reject(new Error('panne')) : base.loadReportsData()) };
    withSource(source, page('etat-locatif'));
    expect(await screen.findByText('Le rapport n’a pas pu être chargé')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('table');
  });

  it('signale un rapport inconnu', () => {
    withSource(undefined, page('inconnu'));
    expect(screen.getByText('Ce rapport n’existe pas ou n’est plus disponible.')).toBeTruthy();
  });
});

describe('aperçu A4 piloté par sa définition', () => {
  it.each(SLUGS)('%s : pages A4 blanches, texte noir, accessibilité', async (slug) => {
    const view = withSource(undefined, preview(slug));
    const pages = await screen.findAllByRole('article', { hidden: true });
    expect(pages.length).toBeGreaterThan(0);
    for (const sheet of pages) {
      expect(sheet.className).toContain('bg-white');
      expect(sheet.className).toContain('text-black');
      expect(sheet.hasAttribute('data-print-page')).toBe(true);
      expect(sheet.hasAttribute('data-paper')).toBe(true);
    }
    expect(screen.getByText(/Page 1 \/ \d+/)).toBeTruthy();
    await expectNoA11yViolations(view.container);
  });

  it('pagine l’export comptable et change de page', async () => {
    withSource(undefined, preview('export-comptable'));
    await screen.findByText(/Page 1 \/ \d+/);
    const total = Number(/Page 1 \/ (\d+)/.exec(screen.getByText(/Page 1 \/ \d+/).textContent)?.[1]);
    expect(total).toBeGreaterThan(5);
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByText(`Page 2 / ${String(total)}`)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Page précédente' }));
    expect(screen.getByText(`Page 1 / ${String(total)}`)).toBeTruthy();
  });

  it('imprime, exporte et bascule le papier à en-tête', async () => {
    withSource(undefined, preview('loyers-impayes', 'periode=year2026&groupe=none'));
    await screen.findByText(/Page 1 \/ 1/);
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer' }));
    expect(print).toHaveBeenCalledTimes(1);
    await userEvent.click(first(screen.getAllByRole('button', { name: 'Télécharger le PDF' })));
    expect(print).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en Excel' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const letterhead = screen.getByRole('switch', { name: 'Papier à en-tête' });
    expect(letterhead.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(letterhead);
    expect(letterhead.getAttribute('aria-checked')).toBe('false');
  });

  it('valide l’e-mail avec Zod puis simule l’envoi', async () => {
    withSource(undefined, preview('prets-immobiliers'));
    await screen.findByText(/Page 1 \/ 1/);
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer par e-mail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Envoyer par e-mail' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect(await within(dialog).findByText('Saisissez une adresse e-mail.')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Destinataire' }), 'marc@exemple.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/Rapport envoyé à marc@exemple.com/)).toBeTruthy();
  });

  it('affiche un état vide quand le périmètre ne contient rien', async () => {
    withSource(undefined, preview('loyers-appeles', 'periode=year2025'));
    expect(await screen.findByText('Aucune donnée à afficher')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier les paramètres' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/loyers-appeles');
    expect(screen.getByRole('button', { name: 'Exporter en Excel' }).hasAttribute('disabled')).toBe(true);
  });

  it('retourne au rapport avec les filtres', async () => {
    withSource(undefined, preview('regularisation-des-charges', 'periode=last3&groupe=none'));
    await screen.findByText(/Page 1 \/ 1/);
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(navigate).toHaveBeenCalledWith('/rapports/regularisation-des-charges?periode=last3&bien=all&locataire=all&groupe=none');
  });

  it('propose de réessayer après une erreur de chargement', async () => {
    const base = createDemoRapportsSource();
    const source: RapportsSource = { ...base, loadReportsData: () => Promise.reject(new Error('panne')) };
    withSource(source, preview('etat-locatif'));
    expect(await screen.findByText('L’aperçu n’a pas pu être chargé')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
