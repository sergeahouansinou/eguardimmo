import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { CourrierApercuPage } from './CourrierApercuPage';
import { CourrierFormPage } from './CourrierFormPage';
import { CourriersPage } from './CourriersPage';
import { ModeleApercuPage } from './ModeleApercuPage';
import { ModeleFormPage } from './ModeleFormPage';
import { ModelesPage } from './ModelesPage';
import type { Courrier, Template } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const courriersOf = async (source: { courriers: () => Promise<unknown> }) => (await source.courriers()) as Courrier[];
const templatesOf = async (source: { templates: () => Promise<unknown> }) => (await source.templates()) as Template[];

describe('CourriersPage', () => {
  it('liste les courriers avec les compteurs d’onglets', async () => {
    const { container } = renderLot(<CourriersPage />);
    const table = await screen.findByRole('table', { name: 'Courriers' });
    expect(dataRows(table)).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /Brouillons/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /À envoyer/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /Envoyés/ }).textContent).toContain('2');
    await expectNoA11yViolations(container);
  });

  it('marque un courrier généré comme envoyé', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0035' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Marquer comme envoyé' }));
    await waitFor(async () => {
      expect((await courriersOf(sources.courriers)).find((item) => item.id === 'cr-2026-0035')).toMatchObject({ status: 'envoye', sentOn: '2026-11-13' });
    });
  });

  it('supprime un brouillon après confirmation et interdit la suppression d’un courrier envoyé', async () => {
    const { sources } = renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0041' }));
    expect((await screen.findByRole('menuitem', { name: 'Supprimer' })).getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, CR-2026-0040' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => {
      expect((await courriersOf(sources.courriers)).some((item) => item.id === 'cr-2026-0040')).toBe(false);
    });
  });

  it('filtre par recherche', async () => {
    renderLot(<CourriersPage />);
    await screen.findByRole('table', { name: 'Courriers' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un courrier' }), 'nadège');
    expect(dataRows(screen.getByRole('table', { name: 'Courriers' }))).toHaveLength(1);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un courrier' }), 'zzz');
    expect(screen.getByText('Aucun courrier ne correspond à ces filtres.')).toBeTruthy();
  });
});

describe('CourrierFormPage', () => {
  it('préremplit la relance depuis le modèle et le locataire de l’adresse', async () => {
    renderLot(<CourrierFormPage />, { search: 'modele=relance-de-loyer-impaye&locataire=koffi-adjovi' });
    expect(await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé')).toBeTruthy();
    const message = screen.getByLabelText('Message *');
    expect(norm((message as HTMLTextAreaElement).value)).toContain('Bonjour M. Koffi Adjovi');
    expect(norm((message as HTMLTextAreaElement).value)).toContain('Apt A1, Les Tilleuls, soit 850 €');
  });

  it('génère le courrier et redirige vers son aperçu', async () => {
    const { sources, push } = renderLot(<CourrierFormPage />, { search: 'modele=relance-de-loyer-impaye&locataire=koffi-adjovi' });
    await screen.findByDisplayValue('Relance, loyer de Novembre 2026 impayé');
    await userEvent.click(screen.getByRole('button', { name: 'Générer le courrier' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/courriers/cr-2026-0042'); });
    expect((await courriersOf(sources.courriers)).find((item) => item.id === 'cr-2026-0042')).toMatchObject({ status: 'genere', tenantId: 'koffi-adjovi', unitId: 'apt-a1', templateId: 'relance-de-loyer-impaye' });
  });

  it('exige un destinataire, un objet et un message', async () => {
    const { push } = renderLot(<CourrierFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Générer le courrier' }));
    expect(await screen.findByText('Choisissez le destinataire')).toBeTruthy();
    expect(screen.getByText('Renseignez l’objet du courrier')).toBeTruthy();
    expect(screen.getByText('Rédigez le contenu du courrier')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('enregistre un brouillon libre, sans modèle', async () => {
    const { sources, push } = renderLot(<CourrierFormPage />);
    await userEvent.click(await screen.findByRole('combobox', { name: /Destinataire/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Awa Traoré' }));
    await userEvent.type(screen.getByLabelText('Objet *'), 'Visite annuelle');
    await userEvent.type(screen.getByLabelText('Message *'), 'Bonjour, une visite est prévue.');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/courriers/cr-2026-0042'); });
    expect((await courriersOf(sources.courriers)).find((item) => item.id === 'cr-2026-0042')).toMatchObject({ status: 'brouillon', templateId: null, tenantId: 'awa-traore' });
  });
});

describe('CourrierApercuPage', () => {
  it('affiche le courrier sur le papier et déclenche l’impression', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { container } = renderLot(<CourrierApercuPage id="cr-2026-0041" />);
    const paper = await screen.findByRole('article', { name: 'Courrier CR-2026-0041' });
    expect(norm(paper.textContent)).toContain('Objet : Relance, loyer de Novembre 2026 impayé');
    expect(norm(paper.textContent)).toContain('Koffi Adjovi');
    expect(paper.hasAttribute('data-print-area')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer' }));
    expect(print).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });

  it('marque un courrier généré comme envoyé depuis l’aperçu', async () => {
    const { sources } = renderLot(<CourrierApercuPage id="cr-2026-0035" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer comme envoyé' }));
    await waitFor(async () => {
      expect((await courriersOf(sources.courriers)).find((item) => item.id === 'cr-2026-0035')?.status).toBe('envoye');
    });
  });

  it('change le zoom et revient à l’ajustement', async () => {
    renderLot(<CourrierApercuPage id="cr-2026-0041" />);
    await screen.findByRole('article', { name: 'Courrier CR-2026-0041' });
    const before = screen.getByText(/ %$/).textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Agrandir le zoom' }));
    expect(screen.getByText(/ %$/).textContent).not.toBe(before);
    await userEvent.click(screen.getByRole('button', { name: 'Ajuster à la largeur' }));
    expect(screen.getByText(/ %$/).textContent).toBe(before);
  });

  it('signale un courrier introuvable', async () => {
    renderLot(<CourrierApercuPage id="inconnu" />);
    expect(await screen.findByText('Il a peut-être été supprimé ou le lien est incorrect.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux courriers' }).getAttribute('href')).toBe('/documents/courriers');
  });
});

describe('ModelesPage', () => {
  it('liste les modèles actifs avec leur origine', async () => {
    const { container } = renderLot(<ModelesPage />);
    const table = await screen.findByRole('table', { name: 'Modèles' });
    expect(dataRows(table)).toHaveLength(6);
    expect(norm(table.textContent)).toContain('Personnalisé');
    await userEvent.click(screen.getByRole('tab', { name: /^Loyers/ }));
    expect(dataRows(screen.getByRole('table', { name: 'Modèles' }))).toHaveLength(3);
    await expectNoA11yViolations(container);
  });

  it('duplique puis supprime la copie, mais refuse de supprimer un modèle déjà utilisé', async () => {
    const { sources } = renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Révision du loyer' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dupliquer' }));
    await waitFor(async () => {
      expect((await templatesOf(sources.courriers)).some((item) => item.id === 'revision-du-loyer-copie')).toBe(true);
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, Révision du loyer, copie' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => {
      expect((await templatesOf(sources.courriers)).some((item) => item.id === 'revision-du-loyer-copie')).toBe(false);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Convocation à l’état des lieux' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Ce modèle a servi à des courriers. Archivez-le plutôt.')).toBeTruthy();
  });

  it('archive un modèle et le retrouve dans l’onglet Archivés', async () => {
    renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Quittance de loyer' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('1'); });
    await userEvent.click(screen.getByRole('tab', { name: /Archivés/ }));
    expect(within(screen.getByRole('table', { name: 'Modèles' })).getByText('Quittance de loyer')).toBeTruthy();
  });
});

describe('ModeleFormPage', () => {
  it('refuse un champ inconnu et un contenu trop court', async () => {
    const { push } = renderLot(<ModeleFormPage />);
    await userEvent.type(await screen.findByLabelText('Nom du modèle *'), 'Rappel');
    await userEvent.type(screen.getByLabelText('Objet *'), 'Rappel');
    await userEvent.type(screen.getByLabelText('Message *'), 'Bonjour {{inconnu}, merci de votre retour rapide.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le modèle' }));
    expect(await screen.findByText(/Champ inconnu : \{inconnu\}/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('crée un modèle en insérant un champ depuis le menu', async () => {
    const { sources, push } = renderLot(<ModeleFormPage />);
    await userEvent.type(await screen.findByLabelText('Nom du modèle *'), 'Rappel amiable');
    await userEvent.type(screen.getByLabelText('Objet *'), 'Rappel, {{mois}');
    await userEvent.type(screen.getByLabelText('Message *'), 'Bonjour {{civilite} ');
    await userEvent.click(screen.getByRole('button', { name: 'Insérer un champ' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Nom du locataire/ }));
    await userEvent.type(screen.getByLabelText('Message *'), ', pensez à régler votre loyer.');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message *').value).toContain('{locataire}');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le modèle' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/modeles'); });
    expect((await templatesOf(sources.courriers)).find((item) => item.id === 'rappel-amiable')).toMatchObject({ builtIn: false, category: 'loyers', subject: 'Rappel, {mois}' });
  });

  it('modifie un modèle personnalisé', async () => {
    const { sources, push } = renderLot(<ModeleFormPage id="convocation-a-l-etat-des-lieux" />);
    const subject = await screen.findByLabelText('Objet *');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Convocation EDL');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/modeles'); });
    expect((await templatesOf(sources.courriers)).find((item) => item.id === 'convocation-a-l-etat-des-lieux')?.subject).toBe('Convocation EDL');
  });

  it('n’autorise pas la modification d’un modèle fourni', async () => {
    renderLot(<ModeleFormPage id="relance-de-loyer-impaye" />);
    expect(await screen.findByText(/Ce modèle fourni ne peut pas être modifié/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer les modifications' })).toBeNull();
  });
});

describe('ModeleApercuPage', () => {
  it('rend le modèle avec des données d’exemple', async () => {
    const { container } = renderLot(<ModeleApercuPage id="relance-de-loyer-impaye" />);
    const paper = await screen.findByRole('article', { name: 'Modèle Relance de loyer impayé' });
    expect(norm(paper.textContent)).toContain('Bonjour M. Koffi Adjovi');
    expect(norm(paper.textContent)).not.toContain('{locataire}');
    expect(at(screen.getAllByRole('link', { name: 'Utiliser ce modèle' }), 0).getAttribute('href')).toBe('/documents/courriers/nouveau?modele=relance-de-loyer-impaye');
    await expectNoA11yViolations(container);
  });
});
