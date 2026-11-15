import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, TestLink } from '../shared/testing';
import { createDemoInterventionsSource } from './demo';
import { InterventionFormPage } from './InterventionFormPage';
import { InterventionsPage } from './InterventionsPage';
import { InterventionsSourceProvider, resetInterventionsDemo } from './source';

const navigate = vi.fn();

beforeEach(() => {
  resetInterventionsDemo();
  navigate.mockReset();
  act(() => { dismissFlash(); });
});

const renderList = () => renderScreen(<InterventionsPage Link={TestLink} navigate={navigate} />);

async function choose(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

const subjects = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('InterventionsPage', () => {
  it('affiche les trois interventions actives de la maquette, urgences en tête', async () => {
    renderList();
    expect(await screen.findByRole('heading', { level: 1, name: 'Interventions' })).toBeTruthy();
    await screen.findByRole('table');
    expect(subjects()).toEqual(['Fuite sous évier', 'Chauffe-eau à remplacer', "Peinture cage d'escalier"]);
    const row = screen.getByRole('row', { name: /Fuite sous évier/ });
    expect(row.textContent).toContain('Apt A1, Les Tilleuls');
    expect(row.textContent).toContain('Plomberie Sanvi');
    expect(row.textContent).toContain('16/11/2026');
    expect(row.textContent).toContain('13/11/2026');
    expect(row.textContent).toContain('Urgente');
    expect(row.textContent).toContain('En cours');
    expect(screen.getByRole('row', { name: /Chauffe-eau/ }).textContent).toContain('À assigner');
    expect(screen.getByRole('tab', { name: /Actives/ }).textContent).toContain('3');
    expect(screen.getByRole('link', { name: 'Ouvrir Fuite sous évier' }).getAttribute('href')).toBe('/interventions/fuite-sous-evier');
    expect(screen.getByRole('link', { name: 'Nouvelle intervention' }).getAttribute('href')).toBe('/interventions/nouvelle');
    expect(screen.getByText('1 à 3 sur 3')).toBeTruthy();
  });

  it('filtre par recherche, priorité et état', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'parc');
    expect(subjects()).toEqual(["Peinture cage d'escalier"]);
    await user.clear(screen.getByRole('searchbox', { name: 'Rechercher' }));
    await choose(user, /^Priorité/, 'Urgente');
    expect(subjects()).toEqual(['Fuite sous évier']);
    await choose(user, /^Priorité/, 'Priorité : Toutes');
    await user.click(screen.getByRole('button', { name: 'Ouverte' }));
    expect(subjects()).toEqual(['Chauffe-eau à remplacer']);
    await user.click(screen.getByRole('button', { name: 'Ouverte' }));
    await user.click(screen.getByRole('button', { name: 'Terminée' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Aucune intervention ne correspond')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(subjects()).toHaveLength(3);
  });

  it('marque « En retard » les interventions dépassées', async () => {
    const user = userEvent.setup();
    const source = createDemoInterventionsSource();
    await source.create({
      subject: 'Radiateur en panne',
      bienId: 'villa-rdc',
      priority: 'normale',
      dueDate: '2026-11-01',
      intervenant: null,
      description: '',
      notifyTenant: false,
      photos: [],
    });
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionsPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'En retard' }));
    expect(subjects()).toEqual(['Radiateur en panne']);
  });

  it('trie par échéance puis revient à l’ordre par défaut', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Échéance' }));
    expect(screen.getByRole('columnheader', { name: 'Échéance' }).getAttribute('aria-sort')).toBe('ascending');
    expect(subjects()).toEqual(['Fuite sous évier', 'Chauffe-eau à remplacer', "Peinture cage d'escalier"]);
    await user.click(screen.getByRole('button', { name: 'Échéance' }));
    expect(subjects()).toEqual(["Peinture cage d'escalier", 'Chauffe-eau à remplacer', 'Fuite sous évier']);
    await user.click(screen.getByRole('button', { name: 'Échéance' }));
    expect(screen.getByRole('columnheader', { name: 'Échéance' }).getAttribute('aria-sort')).toBe('none');
  });

  it('change l’état d’une intervention et confirme par un message', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Chauffe-eau à remplacer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Passer en cours' }));
    const row = await screen.findByRole('row', { name: /Chauffe-eau/ });
    await vi.waitFor(() => { expect(row.textContent).toContain('En cours'); });
    expect(screen.getByRole('status', { name: '' }).textContent).toContain('Chauffe-eau à remplacer');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Chauffe-eau à remplacer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Marquer terminée' }));
    await vi.waitFor(() => { expect(screen.getByRole('row', { name: /Chauffe-eau/ }).textContent).toContain('Terminée'); });
  });

  it('archive une intervention vers l’onglet Archives', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Fuite sous évier' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await vi.waitFor(() => { expect(subjects()).toHaveLength(2); });
    await user.click(screen.getByRole('tab', { name: /Archives/ }));
    expect(subjects()).toContain('Fuite sous évier');
    expect(subjects()).toHaveLength(3);
  });

  it('demande confirmation avant de supprimer et supprime réellement', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Fuite sous évier' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer cette intervention ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(subjects()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Fuite sous évier' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(subjects()).toEqual(['Chauffe-eau à remplacer', "Peinture cage d'escalier"]); });
  });

  it('affiche un état d’erreur avec relance quand le chargement échoue', async () => {
    const source = { ...createDemoInterventionsSource(), list: () => Promise.reject(new Error('panne')) };
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionsPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Les interventions n’ont pas pu être chargées');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('affiche un état vide quand il n’y a aucune intervention', async () => {
    const source = { ...createDemoInterventionsSource(), list: () => Promise.resolve([]) };
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionsPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    expect(await screen.findByText('Aucune intervention active')).toBeTruthy();
  });

  it('refuse une réponse hors contrat', async () => {
    const source = { ...createDemoInterventionsSource(), list: () => Promise.resolve([{ id: 'x' }]) };
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionsPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderList();
    await screen.findByRole('table');
    await expectNoA11yViolations(container);
  });
});

describe('InterventionFormPage', () => {
  const renderForm = () => renderScreen(<InterventionFormPage Link={TestLink} navigate={navigate} />);

  it('signale les champs obligatoires sans créer', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));
    expect(screen.getByText('Indiquez le sujet de l’intervention.')).toBeTruthy();
    expect(screen.getByText('Choisissez le bien concerné.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('crée l’intervention dans la fixture puis revient à la liste avec un message', async () => {
    const user = userEvent.setup();
    const source = createDemoInterventionsSource();
    const { unmount } = renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionFormPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    await user.type(screen.getByRole('textbox', { name: /Sujet/ }), 'Volet roulant bloqué');
    await choose(user, /^Bien/, 'Apt B3, Les Tilleuls');
    await choose(user, /^Priorité/, 'Urgente');
    await choose(user, /^Intervenant/, 'Plomberie Sanvi');
    await user.type(screen.getByLabelText('Échéance'), '2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Créer l’intervention' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/interventions'); });
    unmount();
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionsPage Link={TestLink} navigate={navigate} />
      </InterventionsSourceProvider>,
    );
    expect(await screen.findByRole('row', { name: /Volet roulant bloqué/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Intervention « Volet roulant bloqué » créée.');
  });

  it('valide le type et la taille des photos', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderForm();
    const input = screen.getByLabelText('Choisir des photos');
    await user.upload(input, [
      new File(['x'], 'fuite.png', { type: 'image/png' }),
      new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array(10_000_001)], 'trop-lourde.jpg', { type: 'image/jpeg' }),
    ]);
    expect(screen.getByText('fuite.png')).toBeTruthy();
    expect(screen.getByText(/notes\.pdf : type non pris en charge/)).toBeTruthy();
    expect(screen.getByText(/trop-lourde\.jpg : dépasse 10 Mo/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retirer le fichier fuite.png' }));
    expect(screen.queryByText('fuite.png')).toBeNull();
  });

  it('annule vers la liste', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/interventions');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderForm();
    await expectNoA11yViolations(container);
  });
});
