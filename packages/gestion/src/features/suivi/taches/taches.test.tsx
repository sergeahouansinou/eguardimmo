import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, TestLink } from '../shared/testing';
import { createDemoTasksSource } from './demo';
import { TacheFormPage } from './TacheFormPage';
import { TachesPage } from './TachesPage';
import { resetTasksDemo, TasksSourceProvider } from './source';

const navigate = vi.fn();

beforeEach(() => {
  resetTasksDemo();
  navigate.mockReset();
  act(() => { dismissFlash(); });
});

const renderList = () => renderScreen(<TachesPage Link={TestLink} navigate={navigate} />);
const titles = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1]?.textContent);

async function choose(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('TachesPage', () => {
  it('affiche les tâches à faire de la maquette, en retard en tête', async () => {
    renderList();
    await screen.findByRole('table');
    expect(titles()).toEqual([
      "Attestation d'assurance à demander",
      'Révision du loyer, IRL T3',
      'Relevé des compteurs',
      'Renouvellement assurance PNO',
      'Ramonage annuel',
    ]);
    const first = screen.getByRole('row', { name: /Attestation d'assurance/ });
    expect(first.textContent).toContain('Apt A1');
    expect(first.textContent).toContain('Marie Chabi');
    expect(first.textContent).toContain('10/11/2026');
    expect(first.textContent).toContain('E-mail, 7 jours avant');
    expect(first.textContent).toContain('En retard, 3 jours');
    expect(screen.getByRole('row', { name: /Révision du loyer/ }).textContent).toContain('En retard, 1 jour');
    expect(screen.getByRole('row', { name: /Relevé des compteurs/ }).textContent).toContain('Notification, 2 jours avant');
    expect(screen.getByRole('row', { name: /Relevé des compteurs/ }).textContent).toContain('Cette semaine');
    expect(screen.getByRole('row', { name: /Ramonage/ }).textContent).toContain('À faire');
    expect(screen.getByText('1 à 5 sur 6')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /À faire/ }).textContent).toContain('6');
    expect(screen.getByRole('tab', { name: /En retard/ }).textContent).toContain('2');
    expect(screen.getByRole('tab', { name: /Terminées/ }).textContent).toContain('18');
    expect(screen.getByRole('link', { name: 'Nouvelle tâche' }).getAttribute('href')).toBe('/taches/nouvelle');
  });

  it('bascule entre les onglets et pagine les tâches terminées', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('tab', { name: /En retard/ }));
    expect(titles()).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: /Terminées/ }));
    expect(screen.getByText('1 à 5 sur 18')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('6 à 10 sur 18')).toBeTruthy();
    await choose(user, /par page|Lignes par page/, '25 par page');
    expect(screen.getByText('1 à 18 sur 18')).toBeTruthy();
  });

  it('filtre par recherche, bien, assignée et période', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'assurance');
    expect(titles()).toEqual(["Attestation d'assurance à demander", 'Renouvellement assurance PNO']);
    await user.clear(screen.getByRole('searchbox', { name: 'Rechercher' }));
    await choose(user, /^Bien/, 'Villa RDC');
    expect(titles()).toEqual(['Révision du loyer, IRL T3', 'Ramonage annuel']);
    await choose(user, /^Assignée à/, 'Paul Agossou');
    expect(titles()).toEqual(['Ramonage annuel']);
    await choose(user, /^Bien/, 'Bien : Tous');
    await choose(user, /^Assignée à/, 'Assignée à : Toutes');
    await user.click(screen.getByRole('button', { name: 'Cette semaine' }));
    expect(titles()).toEqual(['Relevé des compteurs']);
    await user.click(screen.getByRole('button', { name: 'Cette semaine' }));
    await user.click(screen.getByRole('button', { name: 'Ce mois-ci' }));
    expect(titles()).toHaveLength(3);
  });

  it('trie par sujet', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Sujet' }));
    expect(titles()[0]).toBe("Attestation d'assurance à demander");
    await user.click(screen.getByRole('button', { name: 'Sujet' }));
    expect(titles()[0]).toBe('Vérification des détecteurs de fumée');
  });

  it('termine une tâche et met à jour les compteurs', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: "Terminer Attestation d'assurance à demander" }));
    await vi.waitFor(() => { expect(titles()).not.toContain("Attestation d'assurance à demander"); });
    expect(screen.getByRole('tab', { name: /À faire/ }).textContent).toContain('5');
    expect(screen.getByRole('tab', { name: /Terminées/ }).textContent).toContain('19');
    expect(screen.getByRole('status').textContent).toContain('terminée');
  });

  it('agit sur la sélection : marquer terminée et reporter', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    expect(screen.queryByRole('region', { name: 'Actions sur la sélection' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner Relevé des compteurs' }));
    const bar = screen.getByRole('region', { name: 'Actions sur la sélection' });
    expect(bar.textContent).toContain('1 tâche sélectionnée');
    await user.click(within(bar).getByRole('button', { name: 'Reporter' }));
    await vi.waitFor(() => { expect(screen.getByRole('row', { name: /Relevé des compteurs/ }).textContent).toContain('27/11/2026'); });
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner toutes les tâches de la page' }));
    expect(screen.getByRole('region', { name: 'Actions sur la sélection' }).textContent).toContain('5 tâches sélectionnées');
    await user.click(screen.getByRole('button', { name: 'Marquer terminée' }));
    await vi.waitFor(() => { expect(screen.getByRole('tab', { name: /Terminées/ }).textContent).toContain('23'); });
  });

  it('ouvre le détail d’une tâche', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Ramonage annuel' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Voir le détail' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ramonage annuel' });
    expect(dialog.textContent).toContain('Villa RDC, Maison Rivière');
    expect(dialog.textContent).toContain('E-mail, 30 jours avant');
  });

  it('supprime après confirmation seulement', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Ramonage annuel' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Supprimer cette tâche ?' })).getByRole('button', { name: 'Annuler' }));
    expect(titles()).toContain('Ramonage annuel');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Ramonage annuel' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(titles()).not.toContain('Ramonage annuel'); });
  });

  it('gère les états erreur, vide et réponse hors contrat', async () => {
    const base = createDemoTasksSource();
    const { unmount } = renderScreen(
      <TasksSourceProvider source={{ ...base, list: () => Promise.reject(new Error('panne')) }}>
        <TachesPage Link={TestLink} navigate={navigate} />
      </TasksSourceProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Les tâches n’ont pas pu être chargées');
    unmount();
    const empty = renderScreen(
      <TasksSourceProvider source={{ ...base, list: () => Promise.resolve([]) }}>
        <TachesPage Link={TestLink} navigate={navigate} />
      </TasksSourceProvider>,
    );
    expect(await screen.findByText('Aucune tâche à faire')).toBeTruthy();
    empty.unmount();
    renderScreen(
      <TasksSourceProvider source={{ ...base, list: () => Promise.resolve([{ id: 'x', title: 3 }]) }}>
        <TachesPage Link={TestLink} navigate={navigate} />
      </TasksSourceProvider>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderList();
    await screen.findByRole('table');
    await expectNoA11yViolations(container);
  });
});

describe('TacheFormPage', () => {
  it('signale les champs obligatoires', async () => {
    const user = userEvent.setup();
    renderScreen(<TacheFormPage Link={TestLink} navigate={navigate} />);
    await user.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    expect(screen.getByText('Indiquez le sujet de la tâche.')).toBeTruthy();
    expect(screen.getByText('Choisissez le bien concerné.')).toBeTruthy();
    expect(screen.getByText('Choisissez la personne assignée.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('crée la tâche puis revient à la liste', async () => {
    const user = userEvent.setup();
    const source = createDemoTasksSource();
    const { unmount } = renderScreen(
      <TasksSourceProvider source={source}>
        <TacheFormPage Link={TestLink} navigate={navigate} />
      </TasksSourceProvider>,
    );
    await user.type(screen.getByRole('textbox', { name: /Sujet/ }), 'Relever le compteur d’eau');
    await choose(user, /^Bien/, 'Apt B3');
    await choose(user, /^Assignée à/, 'Paul Agossou');
    await choose(user, /^Canal/, 'Notification');
    await user.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/taches'); });
    unmount();
    renderScreen(
      <TasksSourceProvider source={source}>
        <TachesPage Link={TestLink} navigate={navigate} />
      </TasksSourceProvider>,
    );
    await screen.findByRole('table');
    expect(screen.getByRole('tab', { name: /À faire/ }).textContent).toContain('7');
    expect(screen.getByRole('status').textContent).toContain('Tâche « Relever le compteur d’eau » créée.');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderScreen(<TacheFormPage Link={TestLink} navigate={navigate} />);
    await expectNoA11yViolations(container);
  });
});
