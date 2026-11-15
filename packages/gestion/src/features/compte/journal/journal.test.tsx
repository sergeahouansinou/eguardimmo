import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { TestLink } from '../../../../test/render';
import { filterEvents, pageNumbers } from './filters';
import { eventsToCsv, JournalPage } from './JournalPage';
import { demoJournalEvents } from './demo';
import { JournalSourceProvider, resetJournalDemo } from './source';
import type { JournalSource } from './source';

function renderPage(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const screenProps = { Link: TestLink, navigate: vi.fn() };

beforeEach(() => {
  resetJournalDemo();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JournalPage', () => {
  it('affiche les événements de la maquette, groupés par jour, avec le total', async () => {
    const { container } = renderPage(<JournalPage {...screenProps} />);
    expect(await screen.findByText('A changé le rôle de Fatou Ndiaye')).toBeTruthy();
    expect(screen.getByText("Aujourd'hui, 13/11/2026")).toBeTruthy();
    expect(screen.getByText('Hier, 12/11/2026')).toBeTruthy();
    expect(screen.getByText('A invité Fatou Ndiaye')).toBeTruthy();
    expect(screen.getByText('A enregistré un paiement de 990 €')).toBeTruthy();
    expect(screen.getByText('A émis la quittance QT-2026-0412')).toBeTruthy();
    expect(screen.getByText('A exporté le rapport Loyers encaissés')).toBeTruthy();
    expect(screen.getAllByText('Connexion refusée').length).toBeGreaterThan(0);
    expect(screen.getByText('1 à 25 sur 184')).toBeTruthy();
    expect(screen.getByText(/ne peut être ni modifié ni supprimé/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Journal d'activité" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('déplie et replie le détail horodaté d’un événement', async () => {
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('A changé le rôle de Fatou Ndiaye');
    const [first] = screen.getAllByRole('button', { name: 'Afficher le détail' });
    if (!first) throw new Error('bouton absent');
    await userEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('13/11/2026 14:52:07 UTC+1')).toBeTruthy();
    expect(screen.getByText('EVT-2026-118402')).toBeTruthy();
    expect(screen.getByText('a91c…04be')).toBeTruthy();
    await userEvent.click(first);
    expect(screen.queryByText('EVT-2026-118402')).toBeNull();
  });

  it('filtre par recherche, par type et par « Sécurité uniquement »', async () => {
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('A changé le rôle de Fatou Ndiaye');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher dans le journal' }), 'Nadège');
    expect(screen.getByText('A enregistré un paiement de 990 €')).toBeTruthy();
    expect(screen.queryByText('A invité Fatou Ndiaye')).toBeNull();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher dans le journal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sécurité uniquement' }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(2);
    expect(within(table).queryByText('A invité Fatou Ndiaye')).toBeNull();
    expect(within(table).getAllByText('Connexion refusée').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Sécurité uniquement' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('filtre par membre', async () => {
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('A changé le rôle de Fatou Ndiaye');
    await userEvent.click(screen.getByRole('combobox', { name: /Membre/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Membre : Julien Morel' }));
    expect(screen.queryByText('A changé le rôle de Fatou Ndiaye')).toBeNull();
    expect(screen.getAllByText('Julien Morel').length).toBeGreaterThan(0);
  });

  it('pagine : page suivante et nombre de lignes par page', async () => {
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('1 à 25 sur 184');
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(screen.getByText('26 à 50 sur 184')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByRole('combobox', { name: /Lignes par page/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Lignes par page 50' }));
    expect(screen.getByText('1 à 50 sur 184')).toBeTruthy();
  });

  it('affiche un état vide avec réinitialisation quand rien ne correspond', async () => {
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('A changé le rôle de Fatou Ndiaye');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher dans le journal' }), 'zzz-introuvable');
    expect(screen.getByText('Aucun événement ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(await screen.findByText('A changé le rôle de Fatou Ndiaye')).toBeTruthy();
  });

  it('exporte les événements filtrés en CSV côté client', async () => {
    const created: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return 'blob:journal';
      },
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderPage(<JournalPage {...screenProps} />);
    await screen.findByText('A changé le rôle de Fatou Ndiaye');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher dans le journal' }), 'Nadège');
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await created[0]?.text();
    expect(text).toContain('Horodatage;Membre;Type');
    expect(text).toContain('A enregistré un paiement de 990 €');
    expect(text).not.toContain('A invité Fatou Ndiaye');
    vi.unstubAllGlobals();
  });

  it('affiche une erreur avec réessai quand la source échoue', async () => {
    const failing: JournalSource = { listEvents: () => Promise.reject(new Error('panne')) };
    renderPage(
      <JournalSourceProvider source={failing}>
        <JournalPage {...screenProps} />
      </JournalSourceProvider>,
    );
    expect(await screen.findByText("Le journal n'a pas pu être chargé")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('affiche un chargement avant les données', () => {
    const pending: JournalSource = { listEvents: () => new Promise(() => undefined) };
    renderPage(
      <JournalSourceProvider source={pending}>
        <JournalPage {...screenProps} />
      </JournalSourceProvider>,
    );
    expect(screen.getByRole('status', { name: 'Chargement du journal' })).toBeTruthy();
  });
});

describe('filtres du journal', () => {
  it('la fixture compte 184 événements, tous dans la période par défaut', () => {
    const events = demoJournalEvents();
    expect(events).toHaveLength(184);
    expect(filterEvents(events, { search: '', from: '2026-11-01', to: '2026-11-13', member: 'all', type: 'all' })).toHaveLength(184);
  });

  it('borne la période de façon inclusive et trie du plus récent au plus ancien', () => {
    const events = demoJournalEvents();
    const rows = filterEvents(events, { search: '', from: '2026-11-12', to: '2026-11-12', member: 'all', type: 'all' });
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.every((row) => row.at.startsWith('2026-11-12'))).toBe(true);
    expect(rows[0]?.at.localeCompare(rows[1]?.at ?? '')).toBeGreaterThan(0);
  });

  it('calcule les pages affichées avec points de suspension', () => {
    expect(pageNumbers(1, 8)).toEqual([1, 2, null, 8]);
    expect(pageNumbers(4, 8)).toEqual([1, null, 3, 4, 5, null, 8]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it('neutralise les formules dans le CSV', () => {
    const [first] = demoJournalEvents();
    if (!first) throw new Error('fixture vide');
    const csv = eventsToCsv([{ ...first, action: '=SOMME(A1)' }]);
    expect(csv).toContain("'=SOMME(A1)");
  });
});

