import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { openExternal } from '../shared/external';
import { renderScreen, TestLink } from '../shared/testing';
import { ContactFormPage } from './ContactFormPage';
import { ContactsPage } from './ContactsPage';
import { createDemoContactsSource } from './demo';
import { ContactsSourceProvider, resetContactsDemo } from './source';

vi.mock('../shared/external', () => ({ openExternal: vi.fn() }));

const navigate = vi.fn();

beforeEach(() => {
  resetContactsDemo();
  navigate.mockReset();
  vi.mocked(openExternal).mockReset();
  act(() => { dismissFlash(); });
});

const renderList = () => renderScreen(<ContactsPage Link={TestLink} navigate={navigate} />);
const names = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.querySelector('span.font-medium')?.textContent);

async function choose(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('ContactsPage', () => {
  it('affiche les cinq premiers contacts de la maquette avec leurs compteurs', async () => {
    renderList();
    await screen.findByRole('table');
    expect(names()).toEqual(['Plomberie Sanvi', 'Peinture Dupont', 'Cabinet Lefèvre', 'Mutuelle Atlantique', 'Hélène Adjovi']);
    const row = screen.getByRole('row', { name: /Plomberie Sanvi/ });
    expect(row.textContent).toContain('Rodrigue Sanvi');
    expect(row.textContent).toContain('Artisan, plombier');
    expect(row.textContent).toContain('+33 6 12 40 18 77');
    expect(row.textContent).toContain('contact@plomberie-sanvi.example');
    expect(row.textContent).toContain('3 biens');
    expect(row.textContent).toContain('Partagé');
    expect(screen.getByRole('row', { name: /Peinture Dupont/ }).textContent).toContain('Résidence du Parc');
    expect(screen.getByRole('row', { name: /Cabinet Lefèvre/ }).textContent).toContain('Privé');
    expect(screen.getByText('1 à 5 sur 24')).toBeTruthy();
    const counts = ['Tous', 'Artisans', 'Syndics', 'Assureurs', 'Garants'].map((label) => screen.getByRole('tab', { name: new RegExp(label) }).textContent);
    expect(counts).toEqual(['Tous24', 'Artisans9', 'Syndics3', 'Assureurs4', 'Garants8']);
    expect(screen.getByRole('link', { name: 'Nouveau contact' }).getAttribute('href')).toBe('/contacts/nouveau');
    expect(screen.getByRole('link', { name: 'Ouvrir Plomberie Sanvi' }).getAttribute('href')).toBe('/contacts/plomberie-sanvi');
  });

  it('filtre par catégorie, recherche, bien et partage, et pagine', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('tab', { name: /Syndics/ }));
    expect(names()).toEqual(['Cabinet Lefèvre', 'Syndic Horizon', 'Gestion Immo Plus']);
    await user.click(screen.getByRole('tab', { name: /Tous/ }));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('6 à 10 sur 24')).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), '43 55 20');
    expect(names()).toEqual(['Cabinet Lefèvre']);
    await user.clear(screen.getByRole('searchbox', { name: 'Rechercher' }));
    await user.click(screen.getByRole('button', { name: 'Partagé' }));
    expect(names()).toEqual(['Plomberie Sanvi']);
    await user.click(screen.getByRole('button', { name: 'Partagé' }));
    await choose(user, /^Bien/, 'Résidence du Parc');
    expect(names()).toContain('Peinture Dupont');
    expect(names()).not.toContain('Cabinet Lefèvre');
  });

  it('trie par nom', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Nom' }));
    expect(names()[0]).toBe('AssurHabitat');
    await user.click(screen.getByRole('button', { name: 'Nom' }));
    expect(names()[0]).toBe('Toiture Dossa');
  });

  it('partage un contact, l’archive puis le retrouve dans les archives', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Peinture Dupont' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Partager avec les locataires' }));
    await vi.waitFor(() => { expect(screen.getByRole('row', { name: /Peinture Dupont/ }).textContent).toContain('Partagé'); });
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Peinture Dupont' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await vi.waitFor(() => { expect(names()).not.toContain('Peinture Dupont'); });
    await user.click(screen.getByRole('tab', { name: /Archives/ }));
    expect(names()).toContain('Peinture Dupont');
  });

  it('appelle, écrit et crée une intervention depuis le menu', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Plomberie Sanvi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Appeler' }));
    expect(openExternal).toHaveBeenCalledWith('tel:+33612401877');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Plomberie Sanvi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Envoyer un e-mail' }));
    expect(openExternal).toHaveBeenCalledWith('mailto:contact@plomberie-sanvi.example');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Plomberie Sanvi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Créer une intervention' }));
    expect(navigate).toHaveBeenCalledWith('/interventions/nouvelle');
  });

  it('supprime après confirmation', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Hélène Adjovi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce contact ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(names()).toContain('Hélène Adjovi');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Hélène Adjovi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(names()).not.toContain('Hélène Adjovi'); });
    expect(screen.getByRole('tab', { name: /Garants/ }).textContent).toContain('7');
  });

  it('gère les états erreur, vide et réponse hors contrat', async () => {
    const base = createDemoContactsSource();
    const failing = renderScreen(
      <ContactsSourceProvider source={{ ...base, list: () => Promise.reject(new Error('panne')) }}>
        <ContactsPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Les contacts n’ont pas pu être chargés');
    failing.unmount();
    const empty = renderScreen(
      <ContactsSourceProvider source={{ ...base, list: () => Promise.resolve([]) }}>
        <ContactsPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );
    expect(await screen.findByText('Aucun contact dans cette catégorie')).toBeTruthy();
    empty.unmount();
    renderScreen(
      <ContactsSourceProvider source={{ ...base, list: () => Promise.resolve([{ id: 'x' }]) }}>
        <ContactsPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderList();
    await screen.findByRole('table');
    await expectNoA11yViolations(container);
  });
});

describe('ContactFormPage', () => {
  const renderForm = (source = createDemoContactsSource()) =>
    renderScreen(
      <ContactsSourceProvider source={source}>
        <ContactFormPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );

  it('valide le nom, la catégorie, le téléphone et l’e-mail', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    expect(screen.getByText('Indiquez le nom du contact.')).toBeTruthy();
    expect(screen.getByText('Choisissez une catégorie.')).toBeTruthy();
    expect(screen.getByText('Indiquez au moins un téléphone ou une adresse e-mail.')).toBeTruthy();
    await user.type(screen.getByLabelText('Téléphone'), '12ab');
    await user.type(screen.getByLabelText('E-mail'), 'pas-un-email');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    expect(screen.getByText(/Indiquez un numéro valide/)).toBeTruthy();
    expect(screen.getByText(/Indiquez une adresse e-mail valide/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('crée le contact dans la fixture puis revient au carnet', async () => {
    const user = userEvent.setup();
    const source = createDemoContactsSource();
    const form = renderForm(source);
    await user.type(screen.getByRole('textbox', { name: /^Nom/ }), 'Électricité Zinsou');
    await choose(user, /^Catégorie/, 'Artisan');
    await user.type(screen.getByLabelText('Téléphone'), '+33 6 12 34 56 78');
    await user.type(screen.getByLabelText('E-mail'), 'contact@zinsou.example');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/contacts'); });
    form.unmount();
    renderScreen(
      <ContactsSourceProvider source={source}>
        <ContactsPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );
    await screen.findByRole('table');
    expect(screen.getByRole('tab', { name: /Tous/ }).textContent).toContain('25');
    expect(screen.getByRole('status').textContent).toContain('Contact « Électricité Zinsou » ajouté au carnet.');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderForm();
    await expectNoA11yViolations(container);
  });
});
