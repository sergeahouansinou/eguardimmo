import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { resetContactsDemo } from '../suivi/contacts/source';
import { dismissFlash } from './flash';
import { ImpayesPage } from './ImpayesPage';
import { RecouvrementPage } from './RecouvrementPage';
import { createDemoFinancesSource } from './source';
import { demoWithOverdueInvoice, IBRAHIM_ECHEANCE, IBRAHIM_FACTURE } from './testing/data';
import { norm, renderFinances, rowAt, snapshotOf } from './testing/render';

const IBRAHIM_BAIL = 'bl-2025-0002';
const createObjectURL = vi.fn(() => 'blob:test');

beforeEach(() => {
  resetContactsDemo();
  createObjectURL.mockClear();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  dismissFlash();
});

async function openedSource() {
  const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
  const opened = await source.dispatch({ type: 'openDossier', requestKey: 'cle-ouverture-1', bailId: IBRAHIM_BAIL, creances: [{ kind: 'echeance', refId: IBRAHIM_ECHEANCE }, { kind: 'facture', refId: IBRAHIM_FACTURE }] });
  return { source, dossierId: opened.id ?? '' };
}

async function chooseCommissaire(name: string) {
  const dialog = await screen.findByRole('dialog', { name: 'Transmettre au commissaire de justice' });
  await userEvent.click(within(dialog).getByRole('combobox', { name: /Commissaire de justice/ }));
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }));
  return dialog;
}

describe('Impayés : ouvrir un dossier par locataire', () => {
  it('liste les créances en retard, cumule la sélection, exige au moins une créance puis ouvre le dossier', async () => {
    const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
    const { navigate } = renderFinances((props) => <ImpayesPage {...props} />, source);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const row = within(table).getAllByRole('row').find((item) => item.textContent.includes('Ibrahim Yao'));
    if (!row) throw new Error('ligne absente');
    await userEvent.click(within(row).getByRole('button', { name: 'Ouvrir un dossier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ouvrir un dossier de recouvrement' });
    const list = within(dialog).getByRole('list', { name: 'Créances en retard' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(norm(list.textContent)).toContain('60 €');
    expect(norm(list.textContent)).toContain('96 €');
    expect(within(dialog).getByRole('checkbox', { name: /Loyer novembre 2026/ })).toHaveProperty('checked', true);
    expect(norm(dialog.textContent)).toContain('Total sélectionné : 60 €');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Facture FA-2026-0022/ }));
    expect(norm(dialog.textContent)).toContain('Total sélectionné : 156 €');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Loyer novembre 2026/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Facture FA-2026-0022/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir le dossier' }));
    expect(within(dialog).getByText('Sélectionnez au moins une créance.')).toBeTruthy();
    expect((await snapshotOf(source)).dossiers).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Loyer novembre 2026/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Facture FA-2026-0022/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir le dossier' }));
    await waitFor(async () => { expect((await snapshotOf(source)).dossiers).toHaveLength(2); });
    const dossier = (await snapshotOf(source)).dossiers[1];
    expect(dossier?.creances).toHaveLength(2);
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/finances/recouvrement/${dossier?.id ?? ''}`); });
  });

  it('propose d’ouvrir le dossier existant ou d’y ajouter les créances', async () => {
    const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
    await source.dispatch({ type: 'openDossier', requestKey: 'cle-ouverture-2', bailId: IBRAHIM_BAIL, creances: [{ kind: 'echeance', refId: IBRAHIM_ECHEANCE }] });
    const { navigate } = renderFinances((props) => <ImpayesPage {...props} />, source);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const row = within(table).getAllByRole('row').find((item) => item.textContent.includes('Ibrahim Yao'));
    if (!row) throw new Error('ligne absente');
    await userEvent.click(within(row).getByRole('button', { name: 'Ouvrir le dossier' }));
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/finances\/recouvrement\/dos-rc-2026-0012/));
  });
});

describe('RecouvrementPage : dossier par locataire', () => {
  it('affiche les créances du dossier, ajoute et retire une créance avec confirmation', async () => {
    const source = createDemoFinancesSource({ seed: demoWithOverdueInvoice() });
    const opened = await source.dispatch({ type: 'openDossier', requestKey: 'cle-ouverture-3', bailId: IBRAHIM_BAIL, creances: [{ kind: 'echeance', refId: IBRAHIM_ECHEANCE }] });
    const { container } = renderFinances((props) => <RecouvrementPage {...props} dossierId={opened.id ?? ''} />, source);
    expect(await screen.findByRole('heading', { name: 'Recouvrement, Ibrahim Yao' })).toBeTruthy();
    const creances = screen.getByRole('table', { name: 'Créances du dossier' });
    expect(within(creances).getAllByRole('row')).toHaveLength(2);
    expect(within(creances).getByRole('button', { name: /Retirer Loyer novembre 2026/ }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des créances' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter des créances au dossier' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Facture FA-2026-0022/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au dossier' }));
    await waitFor(() => { expect(within(screen.getByRole('table', { name: 'Créances du dossier' })).getAllByRole('row')).toHaveLength(3); });
    expect(norm(screen.getByRole('region', { name: 'Chiffres du dossier' }).textContent)).toContain('156 €');

    await userEvent.click(screen.getByRole('button', { name: /Retirer Facture FA-2026-0022/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Retirer la créance du dossier ?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Retirer la créance' }));
    await waitFor(() => { expect(screen.getByText(/Retirée le 13\/11\/2026/)).toBeTruthy(); });
    const dossier = (await snapshotOf(source)).dossiers.find((item) => item.id === opened.id);
    expect(dossier?.creances).toHaveLength(2);
    expect(norm(screen.getByRole('region', { name: 'Chiffres du dossier' }).textContent)).toContain('60 €');
    await expectNoA11yViolations(container);
  });

  it('génère l’envoi, télécharge sans faux succès silencieux, transmet, trace l’acte puis révoque', async () => {
    const { source, dossierId } = await openedSource();
    const { container } = renderFinances((props) => <RecouvrementPage {...props} dossierId={dossierId} />, source);
    await screen.findByRole('heading', { name: 'Recouvrement, Ibrahim Yao' });
    expect(screen.queryByRole('button', { name: 'Télécharger le ZIP' })).toBeNull();
    const pieces = screen.getByRole('list', { name: 'Pièces retenues pour l’envoi' });
    expect(within(pieces).getAllByRole('checkbox')).toHaveLength(5);
    expect(within(pieces).getByRole('checkbox', { name: 'Décompte des sommes dues' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(within(pieces).getByRole('checkbox', { name: /Extrait du grand livre/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Générer l’envoi' }));
    await waitFor(async () => { expect((await snapshotOf(source)).dossiers.find((item) => item.id === dossierId)?.liasses).toHaveLength(1); });
    expect((await snapshotOf(source)).dossiers.find((item) => item.id === dossierId)?.liasses[0]?.pieces).toHaveLength(4);
    const generated = await screen.findByRole('list', { name: 'Envois générés' });
    expect(norm(generated.textContent)).toContain('4 pièces');

    await userEvent.click(screen.getByRole('button', { name: 'Télécharger le ZIP' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Téléchargement simulé en démonstration/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Transmettre au commissaire de justice' }));
    const dialog = await chooseCommissaire('SCP Agbodjo');
    expect(norm(dialog.textContent)).toContain('SCP Agbodjo, etude@scp-agbodjo.example');
    expect(norm(dialog.textContent)).toContain('4 pièces');
    expect(norm(dialog.textContent)).toContain('Le 20/11/2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    const envois = await screen.findByRole('table', { name: 'Historique des envois' });
    const row = rowAt(envois, 1);
    expect(norm(row.textContent)).toContain('SCP Agbodjo');
    expect(norm(row.textContent)).toContain('13/11/2026');
    expect(norm(row.textContent)).toContain('20/11/2026');
    expect(within(row).getByText('Actif')).toBeTruthy();
    const carnet = screen.getByRole('table', { name: 'Carnet des actes' });
    expect(norm(carnet.textContent)).toContain('Pièces transmises par lien sécurisé');

    await userEvent.click(within(row).getByRole('button', { name: 'Révoquer' }));
    const confirm = await screen.findByRole('dialog', { name: 'Révoquer ce lien ?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Révoquer le lien' }));
    await waitFor(() => { expect(within(rowAt(screen.getByRole('table', { name: 'Historique des envois' }), 1)).getByText(/Révoqué/)).toBeTruthy(); });
    expect(norm(screen.getByRole('table', { name: 'Carnet des actes' }).textContent)).toContain('Lien révoqué');
    const data = await snapshotOf(source);
    expect(data.dossiers.find((item) => item.id === dossierId)?.actes.map((acte) => acte.kind)).toEqual(['transmission', 'revocation']);

    await userEvent.click(screen.getByRole('button', { name: 'Renvoyer un lien' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Renvoyer un lien ?' })).getByRole('button', { name: 'Renvoyer un lien' }));
    await waitFor(() => { expect(within(screen.getByRole('table', { name: 'Historique des envois' })).getAllByRole('row')).toHaveLength(3); });
    await expectNoA11yViolations(container);
  });

  it('bloque la transmission vers un contact sans adresse e-mail', async () => {
    const { source, dossierId } = await openedSource();
    await source.dispatch({ type: 'generateLiasse', requestKey: 'cle-liasse-1', dossierId, exclues: [] });
    renderFinances((props) => <RecouvrementPage {...props} dossierId={dossierId} />, source);
    await screen.findByRole('heading', { name: 'Recouvrement, Ibrahim Yao' });
    await userEvent.click(screen.getByRole('button', { name: 'Transmettre au commissaire de justice' }));
    const dialog = await chooseCommissaire('Étude Kpadonou');
    expect(within(dialog).getByText('Ce contact n’a pas d’adresse e-mail')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Envoyer le lien' }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByRole('link', { name: 'Créer un contact' }).getAttribute('href')).toBe('/contacts/nouveau');
    expect((await snapshotOf(source)).dossiers.find((item) => item.id === dossierId)?.transmissions).toEqual([]);
  });

  it('exige de choisir un commissaire de justice', async () => {
    const { source, dossierId } = await openedSource();
    await source.dispatch({ type: 'generateLiasse', requestKey: 'cle-liasse-2', dossierId, exclues: [] });
    renderFinances((props) => <RecouvrementPage {...props} dossierId={dossierId} />, source);
    await userEvent.click(await screen.findByRole('button', { name: 'Transmettre au commissaire de justice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transmettre au commissaire de justice' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));
    expect(within(dialog).getByText('Choisissez le commissaire de justice.')).toBeTruthy();
  });

  it('n’offre la transmission qu’après la génération d’un envoi', async () => {
    const { source, dossierId } = await openedSource();
    renderFinances((props) => <RecouvrementPage {...props} dossierId={dossierId} />, source);
    await screen.findByRole('heading', { name: 'Recouvrement, Ibrahim Yao' });
    expect(screen.queryByRole('button', { name: 'Transmettre au commissaire de justice' })).toBeNull();
    expect(screen.getByText(/Aucun envoi généré/)).toBeTruthy();
    expect(screen.getByText('Aucun envoi')).toBeTruthy();
  });
});
