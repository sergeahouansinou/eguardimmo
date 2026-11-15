import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { diagnosticsSchema } from '../../schemas/lots';
import { documentsSchema } from '../../schemas/common';
import { readingsSchema } from '../../schemas/releves';
import { failingSource, renderBiens } from '../../testing/harness';
import { LotCarac } from './LotCarac';
import { LotCompteurs } from './LotCompteurs';
import { LotDiagnostics } from './LotDiagnostics';
import { LotDocuments } from './LotDocuments';
import { LotEquipements } from './LotEquipements';
import { LotFiche } from './LotFiche';
import { LotFinances } from './LotFinances';
import { LotLocations } from './LotLocations';
import { LotOverview } from './LotOverview';

describe('LotFiche', () => {
  it('affiche l’en-tête, les onglets avec leurs compteurs et la vue d’ensemble', async () => {
    renderBiens(
      <LotFiche id="apt-a1">
        <LotOverview id="apt-a1" />
      </LotFiche>,
      { pathname: '/biens/apt-a1' },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Apt A1' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Diagnostics\s*8/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vue d’ensemble' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('En bref')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Modifier le lot' }).getAttribute('href')).toBe('/biens/apt-a1/modifier');
  });

  it('navigue vers l’onglet choisi', async () => {
    const { push } = renderBiens(<LotFiche id="apt-a1"><p>contenu</p></LotFiche>, { pathname: '/biens/apt-a1' });
    await userEvent.click(await screen.findByRole('tab', { name: /Diagnostics/ }));
    expect(push).toHaveBeenCalledWith('/biens/apt-a1/diagnostics');
  });

  it('indique un lot introuvable avec retour à la liste', async () => {
    renderBiens(<LotFiche id="fantome"><p>contenu</p></LotFiche>, { pathname: '/biens/fantome' });
    expect(await screen.findByText('Ce lot est introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux biens' }).getAttribute('href')).toBe('/biens');
  });

  it('affiche le squelette puis l’erreur partielle avec reprise', async () => {
    renderBiens(<LotFiche id="apt-a1"><p>contenu</p></LotFiche>, { source: failingSource(['lot']), pathname: '/biens/apt-a1' });
    expect(screen.getByRole('status', { name: 'Chargement de la fiche du lot' })).toBeTruthy();
    expect(await screen.findByText('La fiche du lot n’a pas pu être chargée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('isole l’échec d’une carte de la vue d’ensemble', async () => {
    renderBiens(<LotOverview id="apt-a1" />, { source: failingSource(['lotDiagnostics']) });
    expect(await screen.findByText('En bref')).toBeTruthy();
    expect(await screen.findByText('Les diagnostics n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByText('Historique d’occupation')).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = renderBiens(
      <LotFiche id="apt-a1">
        <LotOverview id="apt-a1" />
      </LotFiche>,
      { pathname: '/biens/apt-a1' },
    );
    await screen.findByText('En bref');
    await screen.findByText('Historique d’occupation');
    await expectNoA11yViolations(container);
  });
});

describe('onglets du lot', () => {
  it('caractéristiques : révèle le digicode à la demande', async () => {
    renderBiens(<LotCarac id="apt-a1" />);
    expect(await screen.findByText('Surfaces et pièces')).toBeTruthy();
    expect(screen.getByText('Régime juridique')).toBeTruthy();
    const [toggle] = screen.getAllByRole('button', { name: /Afficher/ });
    expect(toggle).toBeDefined();
    if (toggle) await userEvent.click(toggle);
    expect(screen.getAllByRole('button', { name: /Masquer/ }).length).toBeGreaterThan(0);
  });

  it('diagnostics : ajoute un diagnostic et refuse un formulaire incomplet', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<LotDiagnostics id="apt-a1" />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un diagnostic' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Enregistrer|Ajouter/ }));
    expect((await within(dialog).findAllByText('Champ requis')).length).toBeGreaterThan(0);
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Diagnostic' }), 'Installation gaz');
    await userEvent.type(within(dialog).getByLabelText('Réalisé le'), '2026-11-01');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Résultat' }), 'Conforme');
    await userEvent.click(within(dialog).getByRole('button', { name: /Enregistrer|Ajouter/ }));
    expect(await screen.findByText('Diagnostic « Installation gaz » enregistré')).toBeTruthy();
    const items = diagnosticsSchema.parse(await source.lotDiagnostics('apt-a1')).items;
    expect(items.find((item) => item.label === 'Installation gaz')).toMatchObject({ result: 'Conforme', status: 'valide' });
  });

  it('locations : liste les baux et les vacances', async () => {
    renderBiens(<LotLocations id="apt-a1" />);
    expect(await screen.findByText('Baux et périodes de vacance')).toBeTruthy();
    expect(screen.getByText('Sarah Mensah')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Vacances/ }));
    expect(screen.queryByText('Sarah Mensah')).toBeNull();
  });

  it('équipements : affiche les statistiques et les entretiens à venir', async () => {
    renderBiens(<LotEquipements id="apt-a1" />);
    expect(await screen.findByText('Équipements du lot')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Équipements du lot' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText('Entretiens à venir')).toBeTruthy();
  });

  it('compteurs : enregistre un relevé valide et refuse un index inférieur', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<LotCompteurs id="apt-a1" />, { source });
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau relevé, Électricité/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Date du relevé'), '2026-11-12');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Index/ }), '10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le relevé' }));
    expect(await screen.findByText('Action impossible')).toBeTruthy();
    const index = within(dialog).getByRole('textbox', { name: /Index/ });
    await userEvent.clear(index);
    await userEvent.type(index, '9700');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le relevé' }));
    expect(await screen.findByText('Relevé enregistré')).toBeTruthy();
    const added = readingsSchema.parse(await source.readings()).items.find((item) => item.date === '2026-11-12');
    expect(added).toMatchObject({ index: 9700, delta: 170, lotId: 'apt-a1' });
  });

  it('documents : importe un fichier avec sa catégorie puis refuse un format inconnu', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<LotDocuments id="apt-a1" />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer un fichier ici'), new File(['contenu'], 'quittance.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await within(dialog).findByText('Choisissez une catégorie.')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Catégorie/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bail' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('« quittance.pdf » ajouté')).toBeTruthy();
    const docs = documentsSchema.parse(await source.documents({ kind: 'lot', id: 'apt-a1' }));
    expect(docs.items.find((item) => item.name === 'quittance.pdf')).toMatchObject({ category: 'Bail', shared: false });
  });

  it('documents : rejette un fichier au format non accepté', async () => {
    renderBiens(<LotDocuments id="apt-a1" />, { pathname: '/biens/apt-a1/documents' });
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Déposer un fichier ici');
    await userEvent.upload(input, new File(['x'], 'script.exe', { type: 'application/octet-stream' }), { applyAccept: false });
    expect(await within(dialog).findByText(/format non accepté/)).toBeTruthy();
  });

  it('finances : affiche le rendement et le reste dû', async () => {
    renderBiens(<LotFinances id="apt-a1" />);
    expect(await screen.findByText('Reste dû par le locataire')).toBeTruthy();
    expect(screen.getByText(/Rendement net/)).toBeTruthy();
  });

  it('chaque onglet affiche un état d’erreur quand sa source échoue', async () => {
    renderBiens(<LotFinances id="apt-a1" />, { source: failingSource(['lotFinances']) });
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('les onglets ne présentent aucune violation d’accessibilité', async () => {
    for (const [ui, ready] of [
      [<LotCarac key="c" id="apt-a1" />, 'Surfaces et pièces'],
      [<LotDiagnostics key="d" id="apt-a1" />, 'Dossier de diagnostic technique'],
      [<LotLocations key="l" id="apt-a1" />, 'Baux et périodes de vacance'],
      [<LotEquipements key="e" id="apt-a1" />, 'Équipements du lot'],
      [<LotCompteurs key="m" id="apt-a1" />, 'Historique des relevés'],
      [<LotDocuments key="x" id="apt-a1" />, 'Documents du lot'],
      [<LotFinances key="f" id="apt-a1" />, 'Reste dû par le locataire'],
    ] as const) {
      const { container, unmount } = renderBiens(ui);
      await waitFor(() => { expect(screen.getAllByText(ready).length).toBeGreaterThan(0); });
      await expectNoA11yViolations(container);
      unmount();
    }
  });
});
