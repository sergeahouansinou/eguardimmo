import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { TestLink, renderWithSource } from '../../test/render';
import { createDemoSource, demoBureau } from '../data/demo';
import { BureauPage, bureauSummary } from './BureauPage';

const NBSP = ' ';

describe('BureauPage', () => {
  it('salue l’utilisateur et résume les actions du jour', async () => {
    renderWithSource(<BureauPage Link={TestLink} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Marc' })).toBeTruthy();
    expect(screen.getByText('Vendredi 13 novembre 2026 · 7 actions à traiter, dont 2 urgentes.')).toBeTruthy();
  });

  it('affiche les quatre indicateurs calculés depuis les montants', async () => {
    renderWithSource(<BureauPage Link={TestLink} />);
    const encaisse = await screen.findByRole('region', { name: 'Encaissé en novembre' });
    expect(encaisse.textContent).toContain(`7${NBSP}770${NBSP}€`);
    expect(encaisse.textContent).toContain(`sur 8${NBSP}890${NBSP}€ appelés · 87 %`);
    expect(screen.getByRole('region', { name: 'Impayés' }).textContent).toContain('3 locataires · aucun au-delà de 30 jours');
    expect(screen.getByRole('region', { name: "Taux d'occupation" }).textContent).toContain('11 lots loués sur 14 · 3 vacants');
    const cash = screen.getByRole('region', { name: 'Cash-flow net, novembre' });
    expect(cash.textContent).toContain(`+2${NBSP}640${NBSP}€`);
    expect(cash.textContent).toContain('+14 % vs octobre');
  });

  it('filtre « À traiter » par rubrique', async () => {
    renderWithSource(<BureauPage Link={TestLink} />);
    const card = await screen.findByRole('region', { name: 'À traiter' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(7);
    await userEvent.click(within(card).getByRole('tab', { name: /Baux/ }));
    const items = within(card).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('b')?.textContent)).toEqual([
      'Bail sans renouvellement',
      'Révision de loyer possible',
    ]);
    expect(within(card).getByRole('link', { name: 'Ouvrir le bail' }).getAttribute('href')).toBe('/baux');
  });

  it('liste agenda, échéances et derniers encaissements', async () => {
    renderWithSource(<BureauPage Link={TestLink} />);
    const today = await screen.findByRole('region', { name: "Aujourd'hui" });
    expect(today.textContent).toContain('08:30');
    expect(screen.getByRole('region', { name: 'Échéances' }).textContent).toContain('01/12');
    const payments = screen.getByRole('region', { name: 'Derniers encaissements' });
    expect(payments.textContent).toContain('Studio 2e · partiel');
    expect(payments.textContent).toContain(`2${NBSP}100${NBSP}€`);
  });

  it('décrit le graphique pour les lecteurs d’écran et l’infobulle du mois courant', async () => {
    renderWithSource(<BureauPage Link={TestLink} />);
    const chart = await screen.findByRole('region', { name: 'Loyers, 6 derniers mois' });
    const table = within(chart).getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(chart.textContent).toContain('Novembre 2026');
    expect(chart.textContent).toContain(`Reste dû1${NBSP}120${NBSP}€`);
  });

  it('affiche une alerte quand le chargement échoue', async () => {
    const source = { ...createDemoSource(), bureau: () => Promise.reject(new Error('panne')) };
    renderWithSource(<BureauPage Link={TestLink} />, source);
    expect((await screen.findByRole('alert')).textContent).toContain('Le bureau n’a pas pu être chargé');
  });

  it('refuse une réponse hors contrat au lieu d’afficher des montants faux', async () => {
    const source = { ...createDemoSource(), bureau: () => Promise.resolve({ ...demoBureau, currency: 'USD' }) };
    renderWithSource(<BureauPage Link={TestLink} />, source);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Impayés' })).toBeNull();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderWithSource(<BureauPage Link={TestLink} />);
    await screen.findByRole('region', { name: 'À traiter' });
    await expectNoA11yViolations(container);
  });
});

describe('bureauSummary', () => {
  it('accorde au singulier et omet l’urgence absente', () => {
    const todo = demoBureau.todos[6];
    if (!todo) throw new Error('fixture incomplète');
    expect(bureauSummary({ ...demoBureau, todos: [todo] })).toBe('Vendredi 13 novembre 2026 · 1 action à traiter.');
    expect(bureauSummary({ ...demoBureau, todos: [] })).toBe('Vendredi 13 novembre 2026 · aucune action à traiter.');
  });
});
