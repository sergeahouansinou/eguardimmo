import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { CourrierFormPage } from './CourrierFormPage';
import { ModeleFormPage } from './ModeleFormPage';
import { ModelesPage } from './ModelesPage';
import type { Template } from './schemas';
import { TEMPLATE_FILE_FORMAT } from './templateExchange';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const templatesOf = async (source: { templates: () => Promise<unknown> }) => (await source.templates()) as Template[];
const json = (template: Record<string, unknown>) => JSON.stringify({ format: TEMPLATE_FILE_FORMAT, version: 1, template });
const valid = { name: 'Rappel importé', category: 'loyers', legalFrame: 'meuble', description: 'Importé', subject: 'Rappel, {mois}', body: 'Bonjour {locataire}, merci de régler votre loyer.', suggestRegistered: false };
const upload = (content: string, name = 'modele.json', type = 'application/json') =>
  userEvent.upload(screen.getByLabelText('Fichier de modèle à importer'), new File([content], name, { type }), { applyAccept: false });
const rowNames = () => dataRows(screen.getByRole('table', { name: 'Modèles' })).map((row) => norm(at(within(row).getAllByRole('cell'), 0).textContent));

describe('ModelesPage, importer et exporter', () => {
  it('importe un modèle exporté par l’application et le range parmi les personnalisés', async () => {
    const { sources, container } = renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await upload(json(valid));
    expect(await screen.findByText('Modèle importé')).toBeTruthy();
    const created = (await templatesOf(sources.courriers)).find((item) => item.id === 'rappel-importe');
    expect(created).toMatchObject({ name: 'Rappel importé', builtIn: false, draft: false, legalFrame: 'meuble', sourceId: null, unitId: null });
    await waitFor(() => { expect(screen.getByRole('tab', { name: /^Personnalisés/ }).textContent).toContain('3'); });
    await expectNoA11yViolations(container);
  });

  it('refuse clairement un fichier invalide sans rien créer', async () => {
    const { sources } = renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await upload('pas du json');
    expect(await screen.findByText('Ce fichier n’est pas un JSON valide.')).toBeTruthy();
    await upload(json({ ...valid, category: 'inconnue' }));
    expect(await screen.findByText(/« template\.category » est manquant ou incorrect/)).toBeTruthy();
    await upload(json({ ...valid, body: 'Court' }));
    expect(await screen.findByText(/trop court/)).toBeTruthy();
    await upload('{}', 'modele.txt', 'text/plain');
    expect(await screen.findByText(/Ce type de fichier n’est pas accepté/)).toBeTruthy();
    expect(await templatesOf(sources.courriers)).toHaveLength(9);
  });

  it('exporte un modèle personnalisé en JSON et refuse l’export d’un modèle par défaut', async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:test'; }, revokeObjectURL: vi.fn<(url: string) => void>() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Mise en demeure de payer' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Exporter' }));
    expect(blobs).toHaveLength(1);
    const exported: unknown = JSON.parse(await at(blobs, 0).text());
    expect(exported).toMatchObject({ format: TEMPLATE_FILE_FORMAT, version: 1, template: { name: 'Mise en demeure de payer', legalFrame: 'loi_1989', category: 'recouvrement' } });
    expect(await screen.findByText('Modèle exporté')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Révision du loyer' }));
    expect((await screen.findByRole('menuitem', { name: 'Exporter' })).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('ModelesPage, filtres Bien et Cadre légal', () => {
  it('filtre par cadre légal', async () => {
    renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Cadre/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Loi du 6 juillet 1989' }));
    expect(rowNames()).toHaveLength(6);
    expect(rowNames().join(' ')).toContain('Congé pour vendre');
    expect(rowNames().join(' ')).not.toContain('Attestation de loyer');
    await userEvent.click(screen.getByRole('combobox', { name: /^Cadre/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bail commercial' }));
    expect(await screen.findByText('Aucun modèle ne correspond à cette recherche.')).toBeTruthy();
  });

  it('filtre par bien : un modèle propre à un bien n’apparaît que pour lui, ceux de tous les biens restent', async () => {
    renderLot(
      <>
        <section aria-label="Liste"><ModelesPage /></section>
        <section aria-label="Création"><ModeleFormPage /></section>
      </>,
    );
    const form = within(await screen.findByRole('region', { name: 'Création' }));
    await userEvent.type(await form.findByLabelText('Nom du modèle *'), 'Règlement Apt A1');
    await userEvent.type(form.getByLabelText('Objet *'), 'Règlement intérieur');
    await userEvent.type(form.getByLabelText('Message *'), 'Bonjour {locataire}, voici le règlement.');
    await userEvent.click(form.getByRole('combobox', { name: /^Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Apt A1, Les Tilleuls' }));
    await userEvent.click(form.getByRole('button', { name: 'Créer le modèle' }));
    const list = within(screen.getByRole('region', { name: 'Liste' }));
    await waitFor(() => { expect(rowNames().some((name) => name.includes('Règlement Apt A1'))).toBe(true); });
    await userEvent.click(list.getByRole('combobox', { name: /^Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Apt A2, Les Tilleuls' }));
    expect(rowNames().some((name) => name.includes('Règlement Apt A1'))).toBe(false);
    expect(rowNames()).toHaveLength(9);
    await userEvent.click(list.getByRole('combobox', { name: /^Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Apt A1, Les Tilleuls' }));
    expect(rowNames()).toHaveLength(10);
    expect(norm(screen.getByRole('table', { name: 'Modèles' }).textContent)).toContain('Apt A1, Les Tilleuls');
  });
});

describe('modèles, revenir au modèle par défaut', () => {
  it('restaure le texte du modèle source après confirmation et le refuse sans modèle source', async () => {
    const original = (await templatesOf(renderLot(<ModelesPage />).sources.courriers)).find((item) => item.id === 'conge-pour-vendre');
    const { sources } = renderLot(
      <>
        <section aria-label="Liste"><ModelesPage /></section>
        <section aria-label="Edition"><ModeleFormPage id="conge-pour-vendre-copie" /></section>
      </>,
    );
    const list = within(await screen.findByRole('region', { name: 'Liste' }));
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(list.getByRole('button', { name: 'Personnaliser, Congé pour vendre' }));
    const edit = within(screen.getByRole('region', { name: 'Edition' }));
    const subject = await edit.findByLabelText('Objet *');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Objet modifié');
    await userEvent.click(edit.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(async () => { expect((await templatesOf(sources.courriers)).find((item) => item.id === 'conge-pour-vendre-copie')?.subject).toBe('Objet modifié'); });
    await userEvent.click(await list.findByRole('button', { name: 'Plus d’actions, Congé pour vendre, copie' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Revenir au modèle par défaut' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('Vos modifications seront perdues');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revenir au modèle par défaut' }));
    await waitFor(async () => { expect((await templatesOf(sources.courriers)).find((item) => item.id === 'conge-pour-vendre-copie')?.subject).toBe(original?.subject); });
    const restored = (await templatesOf(sources.courriers)).find((item) => item.id === 'conge-pour-vendre-copie');
    expect(restored).toMatchObject({ body: original?.body, sourceId: 'conge-pour-vendre', builtIn: false });
    await expect(sources.courriers.restoreTemplate('mise-en-demeure-de-payer')).rejects.toThrow('Ce modèle ne remplace aucun modèle par défaut.');
    await expect(sources.courriers.restoreTemplate('conge-pour-vendre')).rejects.toThrow('Ce modèle ne remplace aucun modèle par défaut.');
  });

  it('désactive l’action quand le modèle ne remplace aucun modèle par défaut', async () => {
    renderLot(<ModelesPage />);
    await screen.findByRole('table', { name: 'Modèles' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Mise en demeure de payer' }));
    expect((await screen.findByRole('menuitem', { name: 'Revenir au modèle par défaut' })).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('ModeleFormPage, brouillon, cadre légal et mise en forme', () => {
  it('enregistre un brouillon incomplet : il n’est pas proposé à l’envoi', async () => {
    renderLot(
      <>
        <section aria-label="Liste"><ModelesPage /></section>
        <section aria-label="Création"><ModeleFormPage /></section>
        <section aria-label="Courrier"><CourrierFormPage /></section>
      </>,
    );
    const form = within(await screen.findByRole('region', { name: 'Création' }));
    await userEvent.click(await form.findByRole('button', { name: 'Enregistrer en brouillon' }));
    expect(await screen.findByText('Brouillon impossible')).toBeTruthy();
    await userEvent.type(form.getByLabelText('Nom du modèle *'), 'Modèle en cours');
    await userEvent.click(form.getByRole('button', { name: 'Enregistrer en brouillon' }));
    const list = within(screen.getByRole('region', { name: 'Liste' }));
    await waitFor(() => { expect(list.getByRole('tab', { name: /^Brouillons/ }).textContent).toContain('1'); });
    await userEvent.click(list.getByRole('tab', { name: /^Brouillons/ }));
    const rows = dataRows(screen.getByRole('table', { name: 'Modèles' }));
    expect(rows).toHaveLength(1);
    expect(norm(at(rows, 0).textContent)).toContain('Brouillon');
    expect(within(at(rows, 0)).getByRole('button', { name: 'Utiliser, Modèle en cours' }).hasAttribute('disabled')).toBe(true);
    const courrier = within(screen.getByRole('region', { name: 'Courrier' }));
    await userEvent.click(await courrier.findByRole('combobox', { name: /^Modèle/ }));
    expect(await screen.findByRole('option', { name: 'Relance de loyer impayé' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Modèle en cours' })).toBeNull();
  });

  it('refuse un brouillon dont le texte contient un champ inconnu', async () => {
    const { sources } = renderLot(<ModeleFormPage />);
    await userEvent.type(await screen.findByLabelText('Nom du modèle *'), 'Brouillon');
    await userEvent.type(screen.getByLabelText('Message *'), 'Bonjour {{inconnu}');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }));
    expect(await screen.findByText(/Champ inconnu : \{inconnu\}/)).toBeTruthy();
    expect(await templatesOf(sources.courriers)).toHaveLength(9);
  });

  it('publie un brouillon avec Enregistrer le modèle et enregistre le cadre légal choisi', async () => {
    const { sources, push } = renderLot(<ModeleFormPage />);
    await userEvent.type(await screen.findByLabelText('Nom du modèle *'), 'Bail commercial, rappel');
    await userEvent.click(screen.getByRole('combobox', { name: /^Cadre légal/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bail commercial' }));
    await userEvent.type(screen.getByLabelText('Objet *'), 'Rappel');
    await userEvent.type(screen.getByLabelText('Message *'), 'Bonjour {{locataire}, merci de régler le loyer.');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le modèle' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/modeles'); });
    expect((await templatesOf(sources.courriers)).find((item) => item.id === 'bail-commercial-rappel')).toMatchObject({ legalFrame: 'commercial', draft: false });
  });

  it('met le corps en gras, italique et souligné depuis la barre de mise en forme', async () => {
    const { container } = renderLot(<ModeleFormPage />);
    const body = await screen.findByLabelText<HTMLTextAreaElement>('Message *');
    await userEvent.type(body, 'Bonjour tout le monde');
    body.setSelectionRange(8, 12);
    await userEvent.click(screen.getByRole('button', { name: 'Gras' }));
    expect(body.value).toBe('Bonjour **tout** le monde');
    await waitFor(() => { expect(body.selectionStart).toBe(10); });
    expect(screen.getByText('tout', { selector: 'strong' })).toBeTruthy();
    body.setSelectionRange(0, 7);
    await userEvent.click(screen.getByRole('button', { name: 'Italique' }));
    expect(body.value).toBe('*Bonjour* **tout** le monde');
    await waitFor(() => { expect(body.selectionStart).toBe(1); });
    body.setSelectionRange(body.value.length - 5, body.value.length);
    await userEvent.click(screen.getByRole('button', { name: 'Souligné' }));
    expect(body.value).toBe('*Bonjour* **tout** le __monde__');
    expect(screen.getByText('Bonjour', { selector: 'em' })).toBeTruthy();
    expect(screen.getByText('monde', { selector: 'u' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('exporte le modèle personnalisé depuis son formulaire', async () => {
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn<(url: string) => void>() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderLot(<ModeleFormPage id="mise-en-demeure-de-payer" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter' }));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
