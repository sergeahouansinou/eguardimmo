import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { resetInterventionsDemo } from '../interventions/source';
import { renderScreen, TestLink } from '../shared/testing';
import { resetTasksDemo } from '../taches/source';
import { AgendaPage } from './AgendaPage';
import { createDemoAgendaSource } from './demo';
import { EvenementFormPage } from './EvenementFormPage';
import { AgendaSourceProvider, resetAgendaDemo } from './source';

const navigate = vi.fn();

beforeEach(() => {
  resetAgendaDemo();
  resetInterventionsDemo();
  resetTasksDemo();
  navigate.mockReset();
  act(() => { dismissFlash(); });
});

const renderAgenda = (source = createDemoAgendaSource()) =>
  renderScreen(
    <AgendaSourceProvider source={source}>
      <AgendaPage Link={TestLink} navigate={navigate} />
    </AgendaSourceProvider>,
  );

const grid = async () => within(await screen.findByRole('grid'));
const cell = (date: string) => {
  const found = screen.getByRole('grid').querySelector<HTMLElement>(`[data-date="${date}"]`);
  if (!found) throw new Error(`Cellule absente : ${date}`);
  return found;
};

describe('AgendaPage', () => {
  it('affiche novembre 2026 avec la grille accessible et le jour courant', async () => {
    renderAgenda();
    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda' })).toBeTruthy();
    expect(screen.getByText('Novembre 2026. Les échéances de loyer et les interventions apparaissent automatiquement.')).toBeTruthy();
    const view = await grid();
    expect(screen.getByRole('grid', { name: 'Novembre 2026' })).toBeTruthy();
    expect(view.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']);
    expect(view.getAllByRole('gridcell')).toHaveLength(42);
    expect(cell('2026-11-13').getAttribute('aria-current')).toBe('date');
    expect(within(cell('2026-11-11')).getByText('Intervention, plombier')).toBeTruthy();
    expect(within(cell('2026-11-13')).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Nouvel événement' }).getAttribute('href')).toBe('/agenda/nouveau');
  });

  it('dérive automatiquement échéances, interventions et tâches', async () => {
    renderAgenda();
    await screen.findByRole('grid');
    const sixteenth = within(cell('2026-11-16'));
    expect(sixteenth.getByText('Loyer de novembre, rappel')).toBeTruthy();
    expect(sixteenth.getByText('Fuite sous évier')).toBeTruthy();
    expect(sixteenth.getByText("Renouvellement de l'assurance")).toBeTruthy();
    expect(within(cell('2026-11-20')).getByText('Relevé des compteurs')).toBeTruthy();
    expect(within(cell('2026-11-10')).getByText("Attestation d'assurance à demander")).toBeTruthy();
  });

  it('liste les prochains événements dans « À venir »', async () => {
    renderAgenda();
    const upcoming = await screen.findByRole('region', { name: 'À venir' });
    const rows = within(upcoming).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('b')?.textContent).slice(0, 3)).toEqual([
      'Loyer de novembre, rappel',
      "Renouvellement de l'assurance",
      'Fuite sous évier',
    ]);
    expect(rows[0]?.textContent).toContain('16/11');
    expect(rows[0]?.textContent).toContain('Koffi Adjovi · 09:00');
    expect(rows[1]?.textContent).toContain('Résidence du Parc · 11:00');
    expect(upcoming.textContent).toContain("Émission des avis d'échéance");
    expect(upcoming.textContent).toContain('01/12');
  });

  it('filtre par type et par bien', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    expect(screen.getByRole('button', { name: 'Contrats et diagnostics' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(cell('2026-11-24')).queryByText('Contrôle de la chaudière')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Contrats et diagnostics' }));
    expect(within(cell('2026-11-24')).getByText('Contrôle de la chaudière')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Anniversaires' }));
    expect(within(cell('2026-11-19')).getByText('Anniversaire de Koffi Adjovi')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Interventions' }));
    expect(within(cell('2026-11-16')).queryByText('Fuite sous évier')).toBeNull();

    await user.click(screen.getByRole('combobox', { name: /^Bien/ }));
    await user.click(await screen.findByRole('option', { name: 'Résidence du Parc' }));
    expect(within(cell('2026-11-16')).getByText("Renouvellement de l'assurance")).toBeTruthy();
    expect(within(cell('2026-11-16')).queryByText('Loyer de novembre, rappel')).toBeNull();
  });

  it('navigue entre les mois et revient à aujourd’hui', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByRole('grid', { name: 'Décembre 2026' })).toBeTruthy();
    expect(within(cell('2026-12-01')).getByText("Émission des avis d'échéance")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(screen.getByRole('grid', { name: 'Octobre 2026' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Aujourd’hui' }));
    expect(screen.getByRole('grid', { name: 'Novembre 2026' })).toBeTruthy();
  });

  it('se parcourt au clavier jour par jour, semaine par semaine et mois par mois', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    act(() => { cell('2026-11-13').focus(); });
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cell('2026-11-14'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(cell('2026-11-21'));
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(document.activeElement).toBe(cell('2026-11-13'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(cell('2026-11-09'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(cell('2026-11-15'));
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('grid', { name: 'Décembre 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(cell('2026-12-15'));
    await user.keyboard('{ArrowRight}'.repeat(17));
    expect(screen.getByRole('grid', { name: 'Janvier 2027' })).toBeTruthy();
    expect(cell('2027-01-01').getAttribute('aria-selected')).toBe('true');
  });

  it('bascule en vue liste groupée par jour', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    await user.click(screen.getByRole('radio', { name: 'Liste' }));
    expect(screen.queryByRole('grid')).toBeNull();
    const list = screen.getByRole('region', { name: 'Événements de Novembre 2026' });
    expect(within(list).getByRole('heading', { name: 'Lundi 16 novembre' })).toBeTruthy();
    expect(within(list).getByText('Loyer de novembre, rappel')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(within(screen.getByRole('region', { name: 'Événements de Décembre 2026' })).getByText("Émission des avis d'échéance")).toBeTruthy();
  });

  it('ouvre le lien iCal et le copie réellement dans le presse-papiers', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    await user.click(screen.getByRole('button', { name: 'Lien iCal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lien iCal' });
    const field = await within(dialog).findByRole('textbox', { name: 'Lien iCal' });
    await vi.waitFor(() => { expect((field as HTMLInputElement).value).toMatch(/^https:\/\/.+\.ics$/); });
    await user.click(within(dialog).getByRole('button', { name: 'Copier le lien' }));
    expect(await within(dialog).findByText('Lien copié dans le presse-papiers.')).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe((field as HTMLInputElement).value);
  });

  it('signale l’échec de la copie au lieu de l’avaler', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('grid');
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('refusé'));
    await user.click(screen.getByRole('button', { name: 'Lien iCal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lien iCal' });
    await vi.waitFor(() => { expect(within(dialog).getByRole('button', { name: 'Copier le lien' }).hasAttribute('disabled')).toBe(false); });
    await user.click(within(dialog).getByRole('button', { name: 'Copier le lien' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('La copie automatique a échoué');
  });

  it('répète un événement récurrent sur chaque occurrence du mois', async () => {
    const source = createDemoAgendaSource();
    await source.createEvent({
      title: 'Point hebdomadaire',
      kind: 'rendez_vous',
      date: '2026-11-02',
      time: '08:00',
      bienId: null,
      recurrence: 'hebdomadaire',
      invitees: [],
      notes: '',
      reminder: false,
    });
    renderAgenda(source);
    await screen.findByRole('grid');
    const dates = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'];
    for (const date of dates) expect(within(cell(date)).getByText('Point hebdomadaire')).toBeTruthy();
    expect(within(cell('2026-11-10')).queryByText('Point hebdomadaire')).toBeNull();
  });

  it('affiche une erreur avec relance quand l’agenda ne se charge pas', async () => {
    const source = { ...createDemoAgendaSource(), listEvents: () => Promise.reject(new Error('panne')) };
    renderAgenda(source);
    expect((await screen.findByRole('alert')).textContent).toContain('L’agenda n’a pas pu être chargé');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderAgenda();
    await screen.findByRole('grid');
    await expectNoA11yViolations(container);
  });
});

describe('EvenementFormPage', () => {
  const renderForm = (source = createDemoAgendaSource()) =>
    renderScreen(
      <AgendaSourceProvider source={source}>
        <EvenementFormPage Link={TestLink} navigate={navigate} />
      </AgendaSourceProvider>,
    );

  it('exige un titre, une date et une heure valides', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’événement' }));
    expect(screen.getByText('Indiquez le titre de l’événement.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Date *'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’événement' }));
    expect(screen.getByText('Indiquez une date valide.')).toBeTruthy();
  });

  it('ajoute et retire des personnes invitées', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Personnes invitées' }), 'Léa Martin{Enter}');
    const list = screen.getByRole('list', { name: 'Personnes invitées ajoutées' });
    expect(within(list).getByText('Léa Martin')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Retirer Léa Martin' }));
    expect(screen.queryByRole('list', { name: 'Personnes invitées ajoutées' })).toBeNull();
  });

  it('enregistre l’événement dans la fixture puis retourne à l’agenda avec un message', async () => {
    const user = userEvent.setup();
    const source = createDemoAgendaSource();
    const form = renderForm(source);
    await user.type(screen.getByRole('textbox', { name: /Titre/ }), 'Visite de l’appartement B3');
    await user.clear(screen.getByLabelText('Date *'));
    await user.type(screen.getByLabelText('Date *'), '2026-11-18');
    await user.type(screen.getByLabelText('Heure'), '15:30');
    await user.type(screen.getByRole('textbox', { name: 'Personnes invitées' }), 'Léa Martin');
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’événement' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/agenda'); });
    form.unmount();
    renderAgenda(source);
    await screen.findByRole('grid');
    expect(within(cell('2026-11-18')).getByText('Visite de l’appartement B3')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Événement « Visite de l’appartement B3 » enregistré pour le 18/11/2026.');
  });

  it('annule vers l’agenda', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/agenda');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderForm();
    await expectNoA11yViolations(container);
  });
});
