import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { documentsSchema } from '../../schemas/common';
import { equipementDetailSchema } from '../../schemas/equipements';
import { failingSource, renderBiens } from '../../testing/harness';
import { EquipementDocuments } from './EquipementDocuments';
import { EquipementEntretien } from './EquipementEntretien';
import { EquipementFiche } from './EquipementFiche';
import { EquipementInterventions } from './EquipementInterventions';
import { EquipementOverview } from './EquipementOverview';

const ID = 'climatiseur-reversible';

describe('EquipementFiche', () => {
  it('affiche l’en-tête, les onglets et la vue d’ensemble', async () => {
    renderBiens(
      <EquipementFiche id={ID}>
        <EquipementOverview id={ID} />
      </EquipementFiche>,
      { pathname: '/biens/equipements/climatiseur-reversible' },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Climatiseur réversible' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vue d’ensemble' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Identification')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Modifier' }).some((link) => link.getAttribute('href') === '/biens/equipements/climatiseur-reversible/modifier')).toBe(true);
  });

  it('navigue vers l’onglet choisi', async () => {
    const { push } = renderBiens(<EquipementFiche id={ID}><p>contenu</p></EquipementFiche>, { pathname: '/biens/equipements/climatiseur-reversible' });
    await userEvent.click(await screen.findByRole('tab', { name: /Entretien/ }));
    expect(push).toHaveBeenCalledWith('/biens/equipements/climatiseur-reversible/entretien');
  });

  it('indique un équipement introuvable avec retour à la liste', async () => {
    renderBiens(<EquipementFiche id="fantome"><p>contenu</p></EquipementFiche>);
    expect(await screen.findByText('Cet équipement est introuvable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux équipements' }).getAttribute('href')).toBe('/biens/equipements');
  });

  it('affiche le squelette puis l’erreur avec reprise', async () => {
    renderBiens(<EquipementFiche id={ID}><p>contenu</p></EquipementFiche>, { source: failingSource(['equipement']) });
    expect(screen.getByRole('status', { name: 'Chargement de la fiche de l’équipement' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('vue d’ensemble : isole l’échec de la carte des documents', async () => {
    renderBiens(<EquipementOverview id={ID} />, { source: failingSource(['documents']) });
    expect(await screen.findByText('Identification')).toBeTruthy();
    expect(await screen.findByText('Les documents n’ont pas pu être chargés')).toBeTruthy();
  });

  it('vue d’ensemble : ajoute des photos', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<EquipementOverview id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter des photos' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer les photos ici'), new File(['x'], 'unite-exterieure.png', { type: 'image/png' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Photo ajoutée')).toBeTruthy();
    await waitFor(async () => {
      expect(equipementDetailSchema.parse(await source.equipement(ID))?.values.photoNames).toContain('unite-exterieure.png');
    });
  });

  it('vue d’ensemble : ajoute une entrée au carnet', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<EquipementOverview id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une entrée' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Intitulé' }), 'Recharge de gaz');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter l’entrée' }));
    expect(await screen.findByText('« Recharge de gaz » ajouté au carnet')).toBeTruthy();
    expect(equipementDetailSchema.parse(await source.equipement(ID))?.log.some((entry) => entry.title === 'Recharge de gaz')).toBe(true);
  });

  it('entretien : ajoute une opération au plan puis refuse une saisie invalide', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<EquipementEntretien id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une opération' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter l’opération' }));
    expect(await within(dialog).findByText('Champ requis')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Opération' }), 'Contrôle des fixations');
    const periodicity = within(dialog).getByRole('textbox', { name: 'Périodicité, en mois' });
    await userEvent.clear(periodicity);
    await userEvent.type(periodicity, '999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter l’opération' }));
    expect(await within(dialog).findByText('Entre 1 et 240 mois')).toBeTruthy();
    await userEvent.clear(periodicity);
    await userEvent.type(periodicity, '6');
    await userEvent.type(within(dialog).getByLabelText('Dernière réalisation'), '2027-01-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter l’opération' }));
    expect(await within(dialog).findByText('La date ne peut pas être dans le futur')).toBeTruthy();
    await userEvent.clear(within(dialog).getByLabelText('Dernière réalisation'));
    await userEvent.type(within(dialog).getByLabelText('Dernière réalisation'), '2026-10-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter l’opération' }));
    expect(await screen.findByText('Opération « Contrôle des fixations » ajoutée au plan')).toBeTruthy();
    expect(equipementDetailSchema.parse(await source.equipement(ID))?.plan.some((item) => item.label === 'Contrôle des fixations')).toBe(true);
  });

  it('entretien : trie le plan par opération', async () => {
    renderBiens(<EquipementEntretien id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Opération' }));
    const rows = within(screen.getByRole('table', { name: 'Plan d’entretien' })).getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Contrôle d’étanchéité');
  });

  it('interventions : affiche l’état vide, l’aide en cas de panne et les autres interventions du bien', async () => {
    renderBiens(<EquipementInterventions id={ID} />);
    expect(await screen.findByText('Autres interventions dans Apt A1')).toBeTruthy();
    expect(screen.getByText('Aucune intervention pour l’instant')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Créer une intervention' }).getAttribute('href')).toBe('/interventions/nouvelle');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(within(await screen.findByRole('table', { name: 'Autres interventions dans Apt A1' })).getAllByRole('row')).toHaveLength(3);
  });

  it('documents : importe un fichier avec sa catégorie', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    renderBiens(<EquipementDocuments id={ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Déposer un fichier ici'), new File(['x'], 'facture-filtre.pdf', { type: 'application/pdf' }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Catégorie/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Facture' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('« facture-filtre.pdf » ajouté')).toBeTruthy();
    const docs = documentsSchema.parse(await source.documents({ kind: 'equipement', id: ID }));
    expect(docs.items.find((item) => item.name === 'facture-filtre.pdf')).toMatchObject({ category: 'Facture' });
  });

  it('chaque onglet affiche un état d’erreur quand sa source échoue', async () => {
    const cases = [
      [<EquipementEntretien key="e" id={ID} />, 'equipement'],
      [<EquipementInterventions key="i" id={ID} />, 'equipementInterventions'],
      [<EquipementDocuments key="d" id={ID} />, 'documents'],
    ] as const;
    for (const [ui, method] of cases) {
      const view = renderBiens(ui, { source: failingSource([method]) });
      expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
      view.unmount();
    }
  });

  it('les onglets ne présentent aucune violation d’accessibilité', async () => {
    const cases = [
      [<EquipementOverview key="o" id={ID} />, 'Identification'],
      [<EquipementEntretien key="e" id={ID} />, 'Plan d’entretien'],
      [<EquipementInterventions key="i" id={ID} />, 'En cas de panne'],
      [<EquipementDocuments key="d" id={ID} />, 'Documents de l’équipement'],
    ] as const;
    for (const [ui, ready] of cases) {
      const view = renderBiens(ui);
      await screen.findByText(ready);
      await expectNoA11yViolations(view.container);
      view.unmount();
    }
  });
});
