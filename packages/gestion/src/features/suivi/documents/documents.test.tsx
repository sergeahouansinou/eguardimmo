import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { dismissFlash } from '../../outils/kit';
import { renderScreen, TestLink } from '../shared/testing';
import { createDemoDocumentsSource } from './demo';
import { DocumentImportPage } from './DocumentImportPage';
import { DocumentsPage } from './DocumentsPage';
import { DocumentsSourceProvider, resetDocumentsDemo } from './source';

const navigate = vi.fn();

beforeEach(() => {
  resetDocumentsDemo();
  navigate.mockReset();
  act(() => { dismissFlash(); });
});

const renderList = () => renderScreen(<DocumentsPage Link={TestLink} navigate={navigate} />);
const files = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1]?.textContent);

async function choose(user: ReturnType<typeof userEvent.setup>, field: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('DocumentsPage', () => {
  it('affiche les quatre premiers documents de la maquette et les compteurs', async () => {
    renderList();
    await screen.findByRole('table');
    expect(files().slice(0, 4)).toEqual(['Bail signé, Apt A1.pdf', "État des lieux d'entrée.pdf", 'Diagnostic électrique.pdf', "Attestation d'assurance.pdf"]);
    const bail = screen.getByRole('row', { name: /Bail signé/ });
    expect(bail.textContent).toContain("Bail d'habitation vide");
    expect(bail.textContent).toContain('Koffi Adjovi');
    expect(bail.textContent).toContain('1,2 Mo');
    expect(bail.textContent).toContain('01/04/2026');
    expect(screen.getByRole('row', { name: /Diagnostic électrique/ }).textContent).toContain('860 Ko');
    expect(screen.getByRole('switch', { name: 'Partagé : Bail signé, Apt A1.pdf' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Privé : Diagnostic électrique.pdf' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('tab', { name: /Actifs/ }).textContent).toContain('64');
    expect(screen.getByRole('tab', { name: /Archives/ }).textContent).toContain('12');
    expect(screen.getByText('1 à 10 sur 64')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Importer des documents' }).getAttribute('href')).toBe('/documents/nouveau');
  });

  it('pagine, recherche et filtre', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('11 à 20 sur 64')).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'diagnostic');
    expect(files()).toEqual(['Diagnostic électrique.pdf']);
    await user.clear(screen.getByRole('searchbox', { name: 'Rechercher' }));
    await user.click(screen.getByRole('button', { name: 'Privé' }));
    expect(files()[0]).toBe('Diagnostic électrique.pdf');
    await user.click(screen.getByRole('button', { name: 'Privé' }));
    await choose(user, /^Partage/, 'Partagé avec le locataire');
    expect(screen.getByRole('button', { name: 'Partagé avec le locataire' }).getAttribute('aria-pressed')).toBe('true');
    await choose(user, /^Bien/, 'Apt A1');
    expect(files()[0]).toBe('Bail signé, Apt A1.pdf');
    expect(files().every((name) => (name ?? '').includes('Apt A1') || (name ?? '').includes('État'))).toBe(true);
  });

  it('trie par taille', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Taille' }));
    expect(files()[0]).toBe("Attestation d'assurance.pdf");
  });

  it('agit sur une sélection multiple : partager puis archiver', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner Diagnostic électrique.pdf' }));
    await user.click(screen.getByRole('checkbox', { name: "Sélectionner Attestation d'assurance.pdf" }));
    const bar = screen.getByRole('region', { name: 'Actions sur la sélection' });
    expect(bar.textContent).toContain('2 documents sélectionnés');
    await user.click(within(bar).getByRole('button', { name: 'Partager' }));
    await vi.waitFor(() => { expect(screen.getByRole('switch', { name: 'Partagé : Diagnostic électrique.pdf' })).toBeTruthy(); });
    expect(screen.getByRole('switch', { name: "Partagé : Attestation d'assurance.pdf" })).toBeTruthy();
    await user.click(within(screen.getByRole('region', { name: 'Actions sur la sélection' })).getByRole('button', { name: 'Archiver' }));
    await vi.waitFor(() => { expect(screen.getByRole('tab', { name: /Archives/ }).textContent).toContain('14'); });
    expect(screen.queryByRole('region', { name: 'Actions sur la sélection' })).toBeNull();
  });

  it('bascule le partage depuis l’interrupteur de la ligne', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('switch', { name: 'Privé : Diagnostic électrique.pdf' }));
    await vi.waitFor(() => { expect(screen.getByRole('switch', { name: 'Partagé : Diagnostic électrique.pdf' })).toBeTruthy(); });
  });

  it('renomme, rattache, ouvre le détail et signale le téléchargement indisponible', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Diagnostic électrique.pdf' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Renommer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renommer le document' });
    const field = within(dialog).getByRole('textbox', { name: 'Nom du fichier' });
    await user.clear(field);
    await user.type(field, 'DPE/2031.pdf');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByText(/ne peut pas contenir/)).toBeTruthy();
    await user.clear(field);
    await user.type(field, 'Diagnostic électrique 2031.pdf');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await vi.waitFor(() => { expect(files()).toContain('Diagnostic électrique 2031.pdf'); });

    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Attestation d\'assurance.pdf' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rattacher à un bien' }));
    const attach = await screen.findByRole('dialog', { name: 'Rattacher à un bien' });
    await user.click(within(attach).getByRole('combobox', { name: /^Bien/ }));
    await user.click(await screen.findByRole('option', { name: 'Apt A1, Les Tilleuls' }));
    await user.click(within(attach).getByRole('button', { name: 'Enregistrer' }));
    await vi.waitFor(() => { expect(screen.getByRole('row', { name: /Attestation d'assurance/ }).textContent).toContain('Koffi Adjovi'); });

    await user.click(screen.getByRole('button', { name: 'Ouvrir Bail signé, Apt A1.pdf' }));
    const detail = await screen.findByRole('dialog', { name: 'Bail signé, Apt A1.pdf' });
    expect(detail.textContent).toContain('Apt A1, Les Tilleuls');
    await user.click(within(detail).getAllByRole('button', { name: 'Fermer' }).at(-1) ?? detail);

    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Bail signé, Apt A1.pdf' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Télécharger' }));
    expect(screen.getByText(/Le téléchargement sera disponible/)).toBeTruthy();
  });

  it('propose un nouveau modèle et envoie un document en signature', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    expect(screen.getByRole('link', { name: 'Nouveau modèle' }).getAttribute('href')).toBe('/modeles/nouveau');
    expect(screen.getByRole('link', { name: 'Importer des documents' }).getAttribute('href')).toBe('/documents/nouveau');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Bail signé, Apt A1.pdf' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Envoyer en signature' }));
    expect(navigate).toHaveBeenCalledWith('/documents/signatures/nouvelle?document=Bail%20sign%C3%A9%2C%20Apt%20A1.pdf');
  });

  it('supprime après confirmation, y compris en groupe', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Plus d’actions, Diagnostic électrique.pdf' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Supprimer ce document ?' })).getByRole('button', { name: 'Annuler' }));
    expect(files()).toContain('Diagnostic électrique.pdf');
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner Diagnostic électrique.pdf' }));
    await user.click(screen.getByRole('checkbox', { name: "Sélectionner Attestation d'assurance.pdf" }));
    await user.click(within(screen.getByRole('region', { name: 'Actions sur la sélection' })).getByRole('button', { name: 'Supprimer' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Supprimer 2 documents ?' })).getByRole('button', { name: 'Supprimer' }));
    await vi.waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs/ }).textContent).toContain('62'); });
  });

  it('gère les états erreur, vide et réponse hors contrat', async () => {
    const base = createDemoDocumentsSource();
    const failing = renderScreen(
      <DocumentsSourceProvider source={{ ...base, list: () => Promise.reject(new Error('panne')) }}>
        <DocumentsPage Link={TestLink} navigate={navigate} />
      </DocumentsSourceProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Les documents n’ont pas pu être chargés');
    failing.unmount();
    const empty = renderScreen(
      <DocumentsSourceProvider source={{ ...base, list: () => Promise.resolve([]) }}>
        <DocumentsPage Link={TestLink} navigate={navigate} />
      </DocumentsSourceProvider>,
    );
    expect(await screen.findByText('Aucun document')).toBeTruthy();
    empty.unmount();
    renderScreen(
      <DocumentsSourceProvider source={{ ...base, list: () => Promise.resolve([{ id: 'x' }]) }}>
        <DocumentsPage Link={TestLink} navigate={navigate} />
      </DocumentsSourceProvider>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderList();
    await screen.findByRole('table');
    await expectNoA11yViolations(container);
  });
});

describe('DocumentImportPage', () => {
  const renderImport = (source = createDemoDocumentsSource()) =>
    renderScreen(
      <DocumentsSourceProvider source={source}>
        <DocumentImportPage Link={TestLink} navigate={navigate} />
      </DocumentsSourceProvider>,
    );
  const pdf = (name: string, size = 100) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });

  it('empêche de continuer sans fichier', () => {
    renderImport();
    expect(screen.getByRole('button', { name: 'Suivant' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Étape 1 sur 2 : choisir les fichiers, puis les rattacher.')).toBeTruthy();
  });

  it('accepte les fichiers valides par sélection et refuse type, taille, doublon et excédent', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderImport();
    const input = screen.getByLabelText('Choisir les fichiers à importer');
    await user.upload(input, [
      pdf('Bail signé, Apt A1.pdf', 1_200_000),
      new File(['x'], 'script.exe', { type: 'application/x-msdownload' }),
      new File([new Uint8Array(25_000_001)], 'trop-lourd.pdf', { type: 'application/pdf' }),
    ]);
    expect(screen.getByText('Bail signé, Apt A1.pdf')).toBeTruthy();
    expect(screen.getByText('1,2 Mo · prêt')).toBeTruthy();
    expect(screen.getByText(/script\.exe : type non pris en charge/)).toBeTruthy();
    expect(screen.getByText(/trop-lourd\.pdf : dépasse 25 Mo/)).toBeTruthy();
    await user.upload(input, pdf('Bail signé, Apt A1.pdf', 1_200_000));
    expect(screen.getByText(/Bail signé, Apt A1\.pdf : déjà ajouté/)).toBeTruthy();
    await user.upload(input, Array.from({ length: 20 }, (_, index) => pdf(`Pièce ${String(index)}.pdf`, 10 + index)));
    expect(screen.getByText(/Pièce 19\.pdf : limite de 20 fichiers atteinte/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Retirer le fichier/ })).toHaveLength(20);
  });

  it('accepte les fichiers déposés dans la zone et permet de les retirer', async () => {
    const user = userEvent.setup();
    renderImport();
    const zone = screen.getByTestId('zone-depot');
    fireEvent.drop(zone, { dataTransfer: { files: [pdf("État des lieux d'entrée.pdf", 4_800_000)] } });
    expect(await screen.findByText("État des lieux d'entrée.pdf")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: "Retirer le fichier État des lieux d'entrée.pdf" }));
    expect(screen.queryByText("État des lieux d'entrée.pdf")).toBeNull();
  });

  it('importe en deux étapes puis revient à la liste avec le nouveau document', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const source = createDemoDocumentsSource();
    const page = renderImport(source);
    await user.upload(screen.getByLabelText('Choisir les fichiers à importer'), pdf('Contrat de bail.pdf', 2_000_000));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('Étape 2 sur 2 : rattacher les fichiers à un bien.')).toBeTruthy();
    await user.click(screen.getByRole('combobox', { name: /Bien de Contrat de bail\.pdf/ }));
    await user.click(await screen.findByRole('option', { name: 'Villa RDC, Maison Rivière' }));
    await user.type(screen.getByRole('textbox', { name: 'Description de Contrat de bail.pdf' }), 'Bail 2026');
    await user.click(screen.getByRole('switch', { name: 'Partager avec le locataire' }));
    await user.click(screen.getByRole('button', { name: 'Importer le document' }));
    await vi.waitFor(() => { expect(navigate).toHaveBeenCalledWith('/documents'); });
    page.unmount();
    renderScreen(
      <DocumentsSourceProvider source={source}>
        <DocumentsPage Link={TestLink} navigate={navigate} />
      </DocumentsSourceProvider>,
    );
    await screen.findByRole('table');
    const row = screen.getByRole('row', { name: /Contrat de bail/ });
    expect(row.textContent).toContain('Marc Dossou');
    expect(row.textContent).toContain('13/11/2026');
    expect(screen.getByRole('switch', { name: 'Partagé : Contrat de bail.pdf' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Document importé.');
  });

  it('revient à l’étape 1 et annule vers la liste', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderImport();
    await user.upload(screen.getByLabelText('Choisir les fichiers à importer'), pdf('A.pdf'));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('A.pdf')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/documents');
  });

  it('n’a aucune violation axe aux deux étapes', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderImport();
    await expectNoA11yViolations(container);
    await user.upload(screen.getByLabelText('Choisir les fichiers à importer'), pdf('A.pdf'));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await expectNoA11yViolations(container);
  });
});
