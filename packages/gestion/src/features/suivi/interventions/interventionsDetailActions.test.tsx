import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, TestLink } from '../shared/testing';
import { createDemoInterventionsSource, demoInterventions } from './demo';
import { InterventionDetailPage } from './InterventionDetailPage';
import { InterventionFormPage } from './InterventionFormPage';
import { InterventionsPage } from './InterventionsPage';
import { expenseHref } from './logic';
import { InterventionsSourceProvider, resetInterventionsDemo } from './source';

const navigate = vi.fn();

beforeEach(() => {
  resetInterventionsDemo();
  navigate.mockReset();
  act(() => { dismissFlash(); });
});

const detail = (id: string, source = createDemoInterventionsSource()) =>
  renderScreen(
    <InterventionsSourceProvider source={source}>
      <InterventionDetailPage Link={TestLink} navigate={navigate} id={id} />
    </InterventionsSourceProvider>,
  );

const list = (source = createDemoInterventionsSource()) =>
  renderScreen(
    <InterventionsSourceProvider source={source}>
      <InterventionsPage Link={TestLink} navigate={navigate} />
    </InterventionsSourceProvider>,
  );

const quoteCard = (): HTMLElement => {
  const card = screen.getByRole('heading', { name: 'Devis' }).closest('[aria-labelledby]');
  if (!(card instanceof HTMLElement)) throw new Error('Carte Devis introuvable');
  return card;
};

async function chooseAssignee(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, option: string) {
  await user.click(within(dialog).getByRole('combobox', { name: /^Intervenant/ }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('InterventionDetailPage', () => {
  it('affiche état, intervenant, devis et historique', async () => {
    detail('fuite-sous-evier');
    expect(await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' })).toBeTruthy();
    expect((await screen.findByRole('link', { name: 'Plomberie Sanvi' })).getAttribute('href')).toBe('/contacts/plomberie-sanvi');
    expect(screen.getByText('Locataire').nextElementSibling?.textContent).toBe('Koffi Adjovi');
    const devis = quoteCard();
    expect(devis.textContent).toMatch(/180/);
    expect(devis.textContent).toContain('Accepté');
    const history = screen.getByRole('list', { name: 'Historique de l’intervention' });
    const labels = within(history).getAllByRole('listitem').map((row) => row.querySelector('b')?.textContent);
    expect(labels).toEqual(['État modifié', 'Locataire prévenu', 'Intervenant assigné', 'Intervention créée']);
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe('/interventions/fuite-sous-evier/modifier');
  });

  it('change le statut et consigne l’événement dans l’historique', async () => {
    const user = userEvent.setup();
    detail('fuite-sous-evier');
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await user.click(screen.getByRole('combobox', { name: /^Changer l’état/ }));
    await user.click(await screen.findByRole('option', { name: 'Terminée' }));
    await vi.waitFor(() => {
      const history = screen.getByRole('list', { name: 'Historique de l’intervention' });
      expect(within(history).getAllByRole('listitem')[0]?.textContent).toContain('Terminée');
    });
    expect(screen.getByRole('status').textContent).toContain('terminée');
  });

  it('assigne puis retire un intervenant', async () => {
    const user = userEvent.setup();
    detail('chauffe-eau-a-remplacer');
    await screen.findByRole('heading', { level: 1, name: 'Chauffe-eau à remplacer' });
    expect(screen.getByText('Aucun intervenant assigné.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Assigner un intervenant' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assigner un intervenant' });
    await chooseAssignee(user, dialog, 'Chauffage Mensah');
    await user.click(within(dialog).getByRole('button', { name: 'Assigner' }));
    await vi.waitFor(() => { expect(screen.getByRole('link', { name: 'Chauffage Mensah' }).getAttribute('href')).toBe('/contacts/chauffage-mensah'); });
    expect(screen.getByRole('status').textContent).toContain('est confiée à Chauffage Mensah');
    await user.click(screen.getByRole('button', { name: 'Changer d’intervenant' }));
    const second = await screen.findByRole('dialog', { name: 'Assigner un intervenant' });
    await chooseAssignee(user, second, 'À assigner');
    await user.click(within(second).getByRole('button', { name: 'Assigner' }));
    await vi.waitFor(() => { expect(screen.getByText('Aucun intervenant assigné.')).toBeTruthy(); });
  });

  it('prévient le locataire avec un message préparé consigné dans l’historique', async () => {
    const user = userEvent.setup();
    detail('fuite-sous-evier');
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await user.click(screen.getByRole('button', { name: 'Prévenir le locataire' }));
    const dialog = await screen.findByRole('dialog', { name: 'Prévenir le locataire' });
    const message = within(dialog).getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    expect(message.value).toContain('Bonjour Koffi Adjovi');
    expect(message.value).toContain('Fuite sous évier');
    await user.clear(message);
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer le message' }));
    expect(within(dialog).getByText('Rédigez le message à envoyer.')).toBeTruthy();
    await user.type(message, 'Passage du plombier demain matin');
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer le message' }));
    await vi.waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Prévenir le locataire' })).toBeNull(); });
    const history = screen.getByRole('list', { name: 'Historique de l’intervention' });
    expect(within(history).getAllByRole('listitem')[0]?.textContent).toContain('Passage du plombier demain matin');
  });

  it('refuse de prévenir quand le bien n’a pas de locataire', async () => {
    const user = userEvent.setup();
    detail('peinture-cage-d-escalier');
    await screen.findByRole('heading', { level: 1, name: "Peinture cage d'escalier" });
    await user.click(screen.getByRole('button', { name: 'Prévenir le locataire' }));
    expect(within(await screen.findByRole('dialog', { name: 'Prévenir le locataire' })).getByText('Aucun locataire en place')).toBeTruthy();
  });

  it('ouvre le formulaire de dépense prérempli', async () => {
    const user = userEvent.setup();
    detail('fuite-sous-evier');
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await user.click(screen.getByRole('button', { name: 'Ajouter une dépense' }));
    const target = navigate.mock.calls[0]?.[0] as string;
    const url = new URL(target, 'https://exemple.test');
    expect(url.pathname).toBe('/finances/depenses/nouvelle');
    expect(url.searchParams.get('bien')).toBe('Apt A1, Les Tilleuls');
    expect(url.searchParams.get('fournisseur')).toBe('Plomberie Sanvi');
    expect(url.searchParams.get('montant')).toBe('180');
    expect(url.searchParams.get('description')).toBe('Fuite sous évier');
  });

  it('accepte, refuse puis enregistre un devis', async () => {
    const user = userEvent.setup();
    detail('peinture-cage-d-escalier');
    await screen.findByRole('heading', { level: 1, name: "Peinture cage d'escalier" });
    await user.click(screen.getByRole('button', { name: 'Refuser le devis' }));
    await vi.waitFor(() => { expect(quoteCard().textContent).toContain('Refusé'); });
    await user.click(screen.getByRole('button', { name: 'Modifier le devis' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer un devis' });
    const amount = within(dialog).getByRole('textbox', { name: /Montant/ });
    await user.clear(amount);
    await user.type(amount, 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le devis' }));
    expect(within(dialog).getByText(/Indiquez un montant/)).toBeTruthy();
    await user.clear(amount);
    await user.type(amount, '820,50');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le devis' }));
    await vi.waitFor(() => { expect(quoteCard().textContent).toContain('À valider'); });
    expect(quoteCard().textContent).toMatch(/820,50/);
    await user.click(screen.getByRole('button', { name: 'Accepter le devis' }));
    await vi.waitFor(() => { expect(quoteCard().textContent).toContain('Accepté'); });
  });

  it('archive puis supprime après confirmation', async () => {
    const user = userEvent.setup();
    const source = createDemoInterventionsSource();
    detail('fuite-sous-evier', source);
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await user.click(screen.getByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Archivée')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer cette intervention ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/interventions'); });
    const remaining = (await source.list()) as { id: string }[];
    expect(remaining.some((item) => item.id === 'fuite-sous-evier')).toBe(false);
  });

  it('affiche l’échec d’une action sans rien changer', async () => {
    const user = userEvent.setup();
    const base = createDemoInterventionsSource();
    detail('fuite-sous-evier', { ...base, setArchived: () => Promise.reject(new Error('panne')) });
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await user.click(screen.getByRole('button', { name: 'Archiver' }));
    expect((await screen.findByRole('alert')).textContent).toContain('L’action n’a pas abouti');
    expect(screen.queryByText('Archivée')).toBeNull();
  });

  it('propose un retour quand l’intervention est introuvable', async () => {
    detail('absente');
    expect(await screen.findByRole('heading', { level: 1, name: 'Intervention introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux interventions' }).getAttribute('href')).toBe('/interventions');
  });

  it('signale une erreur de chargement', async () => {
    const base = createDemoInterventionsSource();
    detail('fuite-sous-evier', { ...base, list: () => Promise.reject(new Error('panne')) });
    expect((await screen.findByRole('alert')).textContent).toContain('L’intervention n’a pas pu être chargée');
  });

  it('n’a aucune violation axe', async () => {
    const { container } = detail('fuite-sous-evier');
    await screen.findByRole('heading', { level: 1, name: 'Fuite sous évier' });
    await expectNoA11yViolations(container);
  });
});

describe('Actions de menu de la liste des interventions', () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>, subject: string, action: string) => {
    await user.click(screen.getByRole('button', { name: `Plus d’actions, ${subject}` }));
    await user.click(await screen.findByRole('menuitem', { name: action }));
  };

  it('assigne un intervenant depuis le menu', async () => {
    const user = userEvent.setup();
    list();
    await screen.findByRole('table');
    await openMenu(user, 'Chauffe-eau à remplacer', 'Assigner un intervenant');
    const dialog = await screen.findByRole('dialog', { name: 'Assigner un intervenant' });
    await chooseAssignee(user, dialog, 'Chauffage Mensah');
    await user.click(within(dialog).getByRole('button', { name: 'Assigner' }));
    await vi.waitFor(() => { expect(screen.getByRole('row', { name: /Chauffe-eau à remplacer/ }).textContent).toContain('Chauffage Mensah'); });
  });

  it('prévient le locataire depuis le menu', async () => {
    const user = userEvent.setup();
    const source = createDemoInterventionsSource();
    list(source);
    await screen.findByRole('table');
    await openMenu(user, 'Fuite sous évier', 'Prévenir le locataire');
    const dialog = await screen.findByRole('dialog', { name: 'Prévenir le locataire' });
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer le message' }));
    await vi.waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Prévenir le locataire' })).toBeNull(); });
    const saved = (await source.list()) as { id: string; history: { label: string }[] }[];
    expect(saved.find((item) => item.id === 'fuite-sous-evier')?.history.at(-1)?.label).toBe('Locataire prévenu');
  });

  it('mène à la dépense préremplie et à la modification', async () => {
    const user = userEvent.setup();
    list();
    await screen.findByRole('table');
    await openMenu(user, 'Fuite sous évier', 'Ajouter une dépense');
    const item = demoInterventions.find((candidate) => candidate.id === 'fuite-sous-evier');
    expect(item).toBeDefined();
    if (item) expect(navigate).toHaveBeenCalledWith(expenseHref(item));
    await openMenu(user, 'Fuite sous évier', 'Modifier');
    expect(navigate).toHaveBeenCalledWith('/interventions/fuite-sous-evier/modifier');
  });
});

describe('InterventionFormPage en modification', () => {
  it('préremplit puis enregistre sans dupliquer', async () => {
    const user = userEvent.setup();
    const source = createDemoInterventionsSource();
    renderScreen(
      <InterventionsSourceProvider source={source}>
        <InterventionFormPage Link={TestLink} navigate={navigate} id="fuite-sous-evier" />
      </InterventionsSourceProvider>,
    );
    const subject = await screen.findByRole<HTMLInputElement>('textbox', { name: /Sujet/ });
    expect(subject.value).toBe('Fuite sous évier');
    await user.clear(subject);
    await user.type(subject, 'Fuite sous évier de cuisine');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/interventions/fuite-sous-evier'); });
    const saved = (await source.list()) as { id: string; subject: string; history: { label: string }[] }[];
    expect(saved.filter((item) => item.id === 'fuite-sous-evier')).toHaveLength(1);
    const item = saved.find((candidate) => candidate.id === 'fuite-sous-evier');
    expect(item?.subject).toBe('Fuite sous évier de cuisine');
    expect(item?.history.at(-1)?.label).toBe('Intervention modifiée');
  });

  it('indique une intervention introuvable', async () => {
    renderScreen(<InterventionFormPage Link={TestLink} navigate={navigate} id="absente" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Intervention introuvable' })).toBeTruthy();
  });
});
