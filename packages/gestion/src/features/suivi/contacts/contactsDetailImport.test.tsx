import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { openExternal } from '../shared/external';
import { renderScreen, TestLink } from '../shared/testing';
import { ContactDetailPage } from './ContactDetailPage';
import { ContactFormPage } from './ContactFormPage';
import { ContactsPage } from './ContactsPage';
import { createDemoContactsSource } from './demo';
import { createDemoInterventionsSource } from '../interventions/demo';
import { InterventionsSourceProvider } from '../interventions/source';
import { parseContactsCsv } from './importCsv';
import { ContactsSourceProvider, resetContactsDemo } from './source';

vi.mock('../shared/external', () => ({ openExternal: vi.fn() }));

const navigate = vi.fn();

beforeEach(() => {
  resetContactsDemo();
  navigate.mockReset();
  vi.mocked(openExternal).mockReset();
  act(() => { dismissFlash(); });
});

const detail = (id: string) => renderScreen(<ContactDetailPage Link={TestLink} navigate={navigate} id={id} />);

describe('ContactDetailPage', () => {
  it('affiche coordonnées, notes et interventions liées', async () => {
    detail('plomberie-sanvi');
    expect(await screen.findByRole('heading', { level: 1, name: 'Plomberie Sanvi' })).toBeTruthy();
    expect(screen.getByText('+33 6 12 40 18 77')).toBeTruthy();
    expect(screen.getByText('contact@plomberie-sanvi.example')).toBeTruthy();
    expect(screen.getByText(/Intervient sous 48 h/)).toBeTruthy();
    const link = await screen.findByRole('link', { name: 'Fuite sous évier' });
    expect(link.getAttribute('href')).toBe('/interventions/fuite-sous-evier');
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe('/contacts/plomberie-sanvi/modifier');
  });

  it('appelle et écrit depuis la fiche', async () => {
    const user = userEvent.setup();
    detail('plomberie-sanvi');
    await screen.findByRole('heading', { level: 1, name: 'Plomberie Sanvi' });
    await user.click(screen.getByRole('button', { name: /Appeler/ }));
    expect(openExternal).toHaveBeenCalledWith('tel:+33612401877');
    await user.click(screen.getByRole('button', { name: /Écrire/ }));
    expect(openExternal).toHaveBeenCalledWith('mailto:contact@plomberie-sanvi.example');
  });

  it('indique l’absence d’intervention liée', async () => {
    detail('cabinet-lefevre');
    expect(await screen.findByText('Aucune intervention confiée à ce contact.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer une intervention' })).toBeTruthy();
  });

  it('signale une erreur de chargement des interventions sans masquer la fiche', async () => {
    const base = createDemoInterventionsSource();
    renderScreen(
      <InterventionsSourceProvider source={{ ...base, list: () => Promise.reject(new Error('panne')) }}>
        <ContactDetailPage Link={TestLink} navigate={navigate} id="cabinet-lefevre" />
      </InterventionsSourceProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Cabinet Lefèvre' })).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('Les interventions n’ont pas pu être chargées');
  });

  it('propose un retour quand le contact est introuvable', async () => {
    detail('inconnu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Contact introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour au carnet' }).getAttribute('href')).toBe('/contacts');
  });

  it('demande confirmation avant de supprimer puis redirige vers le carnet', async () => {
    const user = userEvent.setup();
    const source = createDemoContactsSource();
    renderScreen(
      <ContactsSourceProvider source={source}>
        <ContactDetailPage Link={TestLink} navigate={navigate} id="cabinet-lefevre" />
      </ContactsSourceProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Cabinet Lefèvre' });
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce contact ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/contacts'); });
    const remaining = (await source.list()) as { id: string }[];
    expect(remaining.some((contact) => contact.id === 'cabinet-lefevre')).toBe(false);
  });

  it('affiche une erreur quand la suppression échoue', async () => {
    const user = userEvent.setup();
    const base = createDemoContactsSource();
    renderScreen(
      <ContactsSourceProvider source={{ ...base, remove: () => Promise.reject(new Error('panne')) }}>
        <ContactDetailPage Link={TestLink} navigate={navigate} id="cabinet-lefevre" />
      </ContactsSourceProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Cabinet Lefèvre' });
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    expect((await screen.findByRole('alert')).textContent).toContain('La suppression n’a pas abouti');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = detail('plomberie-sanvi');
    await screen.findByRole('link', { name: 'Fuite sous évier' });
    await expectNoA11yViolations(container);
  });
});

describe('ContactFormPage en modification', () => {
  it('préremplit puis enregistre les modifications sans dupliquer le contact', async () => {
    const user = userEvent.setup();
    const source = createDemoContactsSource();
    renderScreen(
      <ContactsSourceProvider source={source}>
        <ContactFormPage Link={TestLink} navigate={navigate} id="cabinet-lefevre" />
      </ContactsSourceProvider>,
    );
    const notes = await screen.findByRole('textbox', { name: /Notes/ });
    expect((notes as HTMLTextAreaElement).value).toContain('Assemblée générale');
    await user.clear(notes);
    await user.type(notes, 'Joindre le gestionnaire le matin');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/contacts/cabinet-lefevre'); });
    const saved = (await source.list()) as { id: string; notes: string }[];
    expect(saved.filter((contact) => contact.id === 'cabinet-lefevre')).toHaveLength(1);
    expect(saved.find((contact) => contact.id === 'cabinet-lefevre')?.notes).toBe('Joindre le gestionnaire le matin');
  });

  it('indique un contact introuvable avec un retour', async () => {
    renderScreen(<ContactFormPage Link={TestLink} navigate={navigate} id="inconnu" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Contact introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour au carnet' }).getAttribute('href')).toBe('/contacts');
  });
});

describe('parseContactsCsv', () => {
  const header = 'Nom;Interlocuteur;Catégorie;Spécialité;Téléphone;E-mail;Biens;Partagé;Notes';
  const mail = 'a@exemple.fr';

  it('accepte une ligne complète', () => {
    const report = parseContactsCsv(`${header}\nElec Plus;Jean;artisan;électricien;+33 6 11 22 33 44;jean@elec.example;Apt A1|Villa RDC;oui;Urgences`);
    expect(report.fatal).toBeNull();
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toHaveLength(1);
    expect(report.accepted[0]).toMatchObject({ name: 'Elec Plus', category: 'artisan', bienIds: ['apt-a1', 'villa-rdc'], shared: true });
  });

  it('rejette ligne par ligne avec le motif', () => {
    const report = parseContactsCsv(
      [header, `Bon Contact;;artisan;;;${mail};Apt A1;non;`, `;;artisan;;;${mail};;non;`, `Mauvais;;inconnue;;;${mail};;non;`, `Bien Faux;;artisan;;;${mail};Atlantide;non;`, `Bon Contact;;artisan;;;${mail};;non;`].join('\n'),
    );
    expect(report.accepted.map((contact) => contact.name)).toEqual(['Bon Contact']);
    expect(report.rejected.map((row) => row.line)).toEqual([3, 4, 5, 6]);
    expect(report.rejected[1]?.reasons.join(' ')).toContain('Catégorie inconnue');
    expect(report.rejected[2]?.reasons.join(' ')).toContain('Bien inconnu');
    expect(report.rejected[3]?.reasons.join(' ')).toContain('double');
  });

  it('refuse un fichier sans colonnes obligatoires, vide ou sans ligne', () => {
    expect(parseContactsCsv('Prénom;Ville\nA;B').fatal).toContain('obligatoires');
    expect(parseContactsCsv('').fatal).toBe('Le fichier est vide.');
    expect(parseContactsCsv(header).fatal).toContain('aucun contact');
  });
});

describe('Import de contacts', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, source = createDemoContactsSource()) => {
    renderScreen(
      <ContactsSourceProvider source={source}>
        <ContactsPage Link={TestLink} navigate={navigate} />
      </ContactsSourceProvider>,
    );
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Importer' }));
    return { source, dialog: await screen.findByRole('dialog', { name: 'Importer des contacts' }) };
  };
  const csv = (content: string, name = 'contacts.csv') => new File([content], name, { type: 'text/csv' });
  const header = 'Nom;Catégorie;E-mail;Biens;Partagé';

  it('contrôle le fichier, signale les rejets puis crée réellement les contacts valides', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { source, dialog } = await open(user);
    await user.upload(
      within(dialog).getByLabelText('Choisir le fichier CSV des contacts'),
      csv([header, 'Elec Plus;artisan;a@exemple.fr;Apt A1;oui', 'Sans Catégorie;;b@exemple.fr;;non', 'Chauffage Mensah;artisan;c@exemple.fr;;non'].join('\n')),
    );
    const status = await within(dialog).findByRole('status');
    expect(status.textContent).toContain('contacts.csv : 2 contacts prêts à importer, 1 ligne rejetée.');
    expect(within(within(dialog).getByRole('list', { name: 'Lignes rejetées' })).getByText(/Ligne 3/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Importer 2 contacts' }));
    await vi.waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Importer des contacts' })).toBeNull(); });
    const saved = (await source.list()) as { name: string }[];
    expect(saved.map((contact) => contact.name)).toEqual(expect.arrayContaining(['Elec Plus', 'Chauffage Mensah']));
    expect(saved.some((contact) => contact.name === 'Sans Catégorie')).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('2 contacts importés');
  });

  it('refuse un fichier d’un autre type, vide ou inexploitable et garde le bouton désactivé', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { dialog } = await open(user);
    const input = within(dialog).getByLabelText('Choisir le fichier CSV des contacts');
    await user.upload(input, new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(await within(dialog).findByText(/n’est pas un fichier CSV/)).toBeTruthy();
    await user.upload(input, csv('', 'vide.csv'));
    expect(await within(dialog).findByText(/est vide/)).toBeTruthy();
    await user.upload(input, csv('Prénom;Ville\nA;B', 'faux.csv'));
    expect(await within(dialog).findByText(/Fichier inexploitable/)).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Importer' }).disabled).toBe(true);
  });

  it('affiche l’erreur quand l’import échoue sans fermer la fenêtre', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const base = createDemoContactsSource();
    const { dialog } = await open(user, { ...base, importMany: () => Promise.reject(new Error('panne')) });
    await user.upload(within(dialog).getByLabelText('Choisir le fichier CSV des contacts'), csv([header, 'Elec Plus;artisan;a@exemple.fr;;non'].join('\n')));
    await user.click(await within(dialog).findByRole('button', { name: 'Importer 1 contact' }));
    expect((await within(dialog).findByText('L’import n’a pas abouti')).textContent).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Importer des contacts' })).toBeTruthy();
  });

  it('n’a aucune violation axe avec un rapport affiché', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { dialog } = await open(user);
    await user.upload(within(dialog).getByLabelText('Choisir le fichier CSV des contacts'), csv([header, 'Elec Plus;artisan;a@exemple.fr;;non', ';artisan;b@exemple.fr;;non'].join('\n')));
    await within(dialog).findByRole('status');
    await expectNoA11yViolations(document.body);
  });
});
