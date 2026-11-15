import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { documentsSchema } from '../../schemas/common';
import { immeubleDetailSchema } from '../../schemas/immeubles';
import { failingSource, renderBiens } from '../../testing/harness';
import { ImmeubleCharges } from './ImmeubleCharges';
import { ImmeubleCopro } from './ImmeubleCopro';
import { ImmeubleDocuments } from './ImmeubleDocuments';
import { ImmeubleEquipements } from './ImmeubleEquipements';
import { ImmeubleFiche } from './ImmeubleFiche';
import { ImmeubleInterventions } from './ImmeubleInterventions';
import { ImmeubleLots } from './ImmeubleLots';
import { ImmeubleOverview } from './ImmeubleOverview';

const ID = 'les-tilleuls';

describe('ImmeubleFiche', () => {
  it('affiche l’en-tête, les onglets avec leurs compteurs et la vue d’ensemble', async () => {
    renderBiens(
      <ImmeubleFiche id={ID}>
        <ImmeubleOverview id={ID} />
      </ImmeubleFiche>,
      { pathname: '/biens/immeubles/les-tilleuls' },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Les Tilleuls' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Copropriété' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Lots\s*8/ })).toBeTruthy();
    expect(await screen.findByText('En bref')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Modifier l’immeuble' }).getAttribute('href')).toBe('/biens/immeubles/les-tilleuls/modifier');
  });

  it('masque l’onglet copropriété pour un immeuble en propriété unique', async () => {
    renderBiens(<ImmeubleFiche id="maison-riviere"><p>contenu</p></ImmeubleFiche>, { pathname: '/biens/immeubles/maison-riviere' });
    await screen.findByRole('heading', { level: 1, name: 'Maison Rivière' });
    expect(screen.queryByRole('tab', { name: 'Copropriété' })).toBeNull();
  });

  it('navigue vers l’onglet choisi', async () => {
    const { push } = renderBiens(<ImmeubleFiche id={ID}><p>contenu</p></ImmeubleFiche>, { pathname: '/biens/immeubles/les-tilleuls' });
    await userEvent.click(await screen.findByRole('tab', { name: /Interventions/ }));
    expect(push).toHaveBeenCalledWith('/biens/immeubles/les-tilleuls/interventions');
  });

  it('indique un immeuble introuvable avec retour à la liste', async () => {
    renderBiens(<ImmeubleFiche id="fantome"><p>contenu</p></ImmeubleFiche>);
    expect(await screen.findByText('Cet immeuble est introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux immeubles' }).getAttribute('href')).toBe('/biens/immeubles');
  });

  it('affiche le squelette puis l’erreur avec reprise', async () => {
    renderBiens(<ImmeubleFiche id={ID}><p>contenu</p></ImmeubleFiche>, { source: failingSource(['immeuble']) });
    expect(screen.getByRole('status', { name: 'Chargement de la fiche de l’immeuble' })).toBeTruthy();
    expect(await screen.findByText('La fiche de l’immeuble n’a pas pu être chargée')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('vue d’ensemble : isole l’échec de la carte des lots', async () => {
    renderBiens(<ImmeubleOverview id={ID} />, { source: failingSource(['lots']) });
    expect(await screen.findByText('En bref')).toBeTruthy();
    expect(await screen.findByText('Les lots n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByText('Clés de répartition')).toBeTruthy();
  });

  it('vue d’ensemble : ajoute des photos à l’immeuble', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<ImmeubleOverview id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter des photos' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer les photos ici'), new File(['x'], 'cour.jpg', { type: 'image/jpeg' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Photo ajoutée')).toBeTruthy();
    await waitFor(async () => {
      expect(immeubleDetailSchema.parse(await source.immeuble(ID))?.values.photoNames).toContain('cour.jpg');
    });
  });

  it('lots : détaille les statistiques et les tantièmes', async () => {
    renderBiens(<ImmeubleLots id={ID} />);
    expect(await screen.findByText('Tantièmes généraux par lot')).toBeTruthy();
    expect(screen.getByText('824 / 1 000')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: /lots/i })).getByRole('link', { name: 'Apt A1' }).getAttribute('href')).toBe('/biens/apt-a1');
  });

  it('charges : affiche les postes avec leur total puis importe l’appel de fonds', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<ImmeubleCharges id={ID} />, { source });
    expect(await screen.findByText('Postes du budget 2026')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Postes du budget' })).getByText('Gardiennage')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Importer l’appel de fonds' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await within(dialog).findByText('Choisissez un fichier à importer.')).toBeTruthy();
    await userEvent.upload(within(dialog).getByLabelText('Déposer l’appel de fonds ici'), new File(['x'], 'appel-t1.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('« appel-t1.pdf » importé')).toBeTruthy();
    const docs = documentsSchema.parse(await source.documents({ kind: 'immeuble', id: ID }));
    expect(docs.items.find((item) => item.name === 'appel-t1.pdf')).toMatchObject({ category: 'Appel de fonds' });
  });

  it('charges : rejette un format de fichier non accepté', async () => {
    renderBiens(<ImmeubleCharges id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer l’appel de fonds' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer l’appel de fonds ici'), new File(['x'], 'macro.exe', { type: 'application/octet-stream' }), { applyAccept: false });
    expect(await within(dialog).findByText(/format non accepté/)).toBeTruthy();
  });

  it('copropriété : pagine les assemblées et ajoute un procès-verbal', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<ImmeubleCopro id={ID} />, { source });
    expect(await screen.findByText('Syndic et conseil syndical')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Assemblées générales' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(within(await screen.findByRole('table', { name: 'Assemblées générales' })).getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un procès-verbal' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer le procès-verbal ici'), new File(['x'], 'pv-2027.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('« pv-2027.pdf » importé')).toBeTruthy();
    const docs = documentsSchema.parse(await source.documents({ kind: 'immeuble', id: ID }));
    expect(docs.items.find((item) => item.name === 'pv-2027.pdf')).toMatchObject({ category: 'Assemblée' });
  });

  it('équipements communs : signale le contrôle en retard', async () => {
    renderBiens(<ImmeubleEquipements id={ID} />);
    expect(await screen.findByText('Équipements des parties communes')).toBeTruthy();
    expect(screen.getAllByText(/En retard/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Ajouter un équipement' }).getAttribute('href')).toBe('/biens/equipements/nouveau');
  });

  it('documents : importe un fichier dans le dossier de l’immeuble', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<ImmeubleDocuments id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer un fichier ici'), new File(['x'], 'rapport.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Catégorie/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Travaux' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('« rapport.pdf » ajouté')).toBeTruthy();
    const docs = documentsSchema.parse(await source.documents({ kind: 'immeuble', id: ID }));
    expect(docs.items.find((item) => item.name === 'rapport.pdf')).toMatchObject({ category: 'Travaux' });
  });

  it('interventions : pagine la liste et lie la création', async () => {
    renderBiens(<ImmeubleInterventions id={ID} />);
    expect(await screen.findByText('Interventions dans l’immeuble')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Interventions de l’immeuble' })).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'Créer une intervention' }).getAttribute('href')).toBe('/interventions/nouvelle');
  });

  it('chaque onglet affiche un état d’erreur quand sa source échoue', async () => {
    const cases = [
      [<ImmeubleCharges key="c" id={ID} />, 'immeubleCharges'],
      [<ImmeubleCopro key="p" id={ID} />, 'immeubleCopro'],
      [<ImmeubleInterventions key="i" id={ID} />, 'immeubleInterventions'],
      [<ImmeubleEquipements key="e" id={ID} />, 'equipements'],
    ] as const;
    for (const [ui, method] of cases) {
      const view = renderBiens(ui, { source: failingSource([method]) });
      expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
      view.unmount();
    }
  });

  it('les onglets ne présentent aucune violation d’accessibilité', async () => {
    const cases = [
      [<ImmeubleOverview key="o" id={ID} />, 'Clés de répartition'],
      [<ImmeubleLots key="l" id={ID} />, 'Tantièmes généraux par lot'],
      [<ImmeubleCharges key="c" id={ID} />, 'Postes du budget 2026'],
      [<ImmeubleCopro key="p" id={ID} />, 'Syndic et conseil syndical'],
      [<ImmeubleEquipements key="e" id={ID} />, 'Équipements des parties communes'],
      [<ImmeubleDocuments key="d" id={ID} />, 'Documents de l’immeuble'],
      [<ImmeubleInterventions key="i" id={ID} />, 'Interventions dans l’immeuble'],
    ] as const;
    for (const [ui, ready] of cases) {
      const view = renderBiens(ui);
      await screen.findByText(ready);
      await expectNoA11yViolations(view.container);
      view.unmount();
    }
  });
});
