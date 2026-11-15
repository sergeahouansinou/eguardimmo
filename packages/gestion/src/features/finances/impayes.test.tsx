import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { dismissFlash } from './flash';
import { ImpayesPage } from './ImpayesPage';
import { RecouvrementPage } from './RecouvrementPage';
import { createDemoFinancesSource } from './source';
import { norm, renderFinances, rowAt, snapshotOf } from './testing/render';

const KOFFI = 'ech-2026-11-koffi-adjovi';

afterEach(dismissFlash);

describe('ImpayesPage', () => {
  it('liste les impayés par ancienneté avec leur total et leur prochaine étape', async () => {
    const { container } = renderFinances((props) => <ImpayesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(norm(rowAt(table, 1).textContent)).toContain('Koffi Adjovi');
    expect(norm(rowAt(table, 1).textContent)).toContain('850 €');
    expect(norm(rowAt(table, 1).textContent)).toContain('12 jours');
    const kpis = screen.getByRole('region', { name: 'Chiffres des impayés' });
    expect(norm(kpis.textContent)).toContain('1 120 €');
    expect(norm(kpis.textContent)).toContain('3 dossiers');
    expect(screen.getByRole('heading', { name: 'Impayés' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('filtre par recherche et efface les filtres', async () => {
    renderFinances((props) => <ImpayesPage {...props} />);
    await screen.findByRole('table', { name: 'Impayés' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'clarisse');
    const rows = within(screen.getByRole('table', { name: 'Impayés' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'zzz');
    expect(screen.getByText('Aucun impayé ne correspond aux filtres')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(within(screen.getByRole('table', { name: 'Impayés' })).getAllByRole('row').slice(1)).toHaveLength(3);
  });

  it('l’onglet « Plus de 15 jours » est vide à la date de démonstration', async () => {
    renderFinances((props) => <ImpayesPage {...props} />);
    await screen.findByRole('table', { name: 'Impayés' });
    await userEvent.click(screen.getByRole('tab', { name: /Plus de 15 jours/ }));
    expect(screen.getByText('Aucun impayé ne correspond aux filtres')).toBeTruthy();
  });

  it('relance la sélection : une relance est tracée par dossier et le compteur du mois augmente', async () => {
    const { source } = renderFinances((props) => <ImpayesPage {...props} />);
    await screen.findByRole('table', { name: 'Impayés' });
    const before = (await snapshotOf(source)).relances.length;
    expect(screen.getByRole('button', { name: 'Relancer la sélection' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Koffi Adjovi' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Clarisse Hounkpatin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Relancer la sélection' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).relances).toHaveLength(before + 2);
    });
    expect(await screen.findByText('2 relances envoyées.')).toBeTruthy();
  });

  it('ouvre le dossier de recouvrement d’une ligne', async () => {
    const { navigate } = renderFinances((props) => <ImpayesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Ouvrir' }));
    expect(navigate).toHaveBeenCalledWith(`/finances/impayes/${KOFFI}`);
  });

  it('propose un échéancier avec aperçu, puis l’enregistre', async () => {
    const { source } = renderFinances((props) => <ImpayesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const row = rowAt(table, 2);
    await userEvent.click(within(row).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Proposer un échéancier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Proposer un échéancier' });
    const preview = within(dialog).getByRole('list', { name: 'Aperçu de l’échéancier' });
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3);
    expect(norm(preview.textContent)).toContain('70 €');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Proposer l’échéancier' }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.dossiers.filter((dossier) => dossier.plan !== null)).toHaveLength(1);
    });
  });

  it('passe en irrécouvrable après confirmation seulement', async () => {
    const { source } = renderFinances((props) => <ImpayesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const row = rowAt(table, 3);
    await userEvent.click(within(row).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Passer en irrécouvrable' }));
    const dialog = await screen.findByRole('dialog', { name: 'Passer la créance en irrécouvrable ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect((await snapshotOf(source)).echeances.find((item) => item.id === 'ech-2026-11-ibrahim-yao')?.statut).toBe('active');
    await userEvent.click(within(row).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Passer en irrécouvrable' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Passer en irrécouvrable' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).echeances.find((item) => item.id === 'ech-2026-11-ibrahim-yao')?.statut).toBe('irrecouvrable');
    });
  });

  it('le menu d’une ligne ouvre l’aperçu de la relance, la mise en demeure, le grand livre, l’acompte et le dossier', async () => {
    const { navigate } = renderFinances((props) => <ImpayesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Impayés' });
    const open = async (name: string) => {
      await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
      await userEvent.click(await screen.findByRole('menuitem', { name }));
    };
    await open('Aperçu de la relance');
    expect(navigate).toHaveBeenLastCalledWith(`/finances/impayes/${KOFFI}/relance`);
    await open('Mise en demeure');
    expect(navigate).toHaveBeenLastCalledWith(`/finances/impayes/${KOFFI}/relance?niveau=mise_en_demeure`);
    await open('Grand livre du locataire');
    expect(navigate).toHaveBeenLastCalledWith(`/finances/impayes/${KOFFI}/grand-livre`);
    await open('Enregistrer un acompte');
    expect(navigate).toHaveBeenLastCalledWith('/finances/encaissements/acompte?bail=bl-2023-0007');
    await open('Dossier de recouvrement');
    expect(navigate).toHaveBeenLastCalledWith(`/finances/impayes/${KOFFI}`);
  });

  it('affiche une erreur de chargement avec un bouton Réessayer', async () => {
    const source = createDemoFinancesSource();
    renderFinances((props) => <ImpayesPage {...props} />, { ...source, snapshot: () => Promise.reject(new Error('panne')) });
    expect(await screen.findByText('Les impayés n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});

describe('RecouvrementPage', () => {
  it('reprend le dossier : chiffres, étapes, carnet et facture des frais', async () => {
    const { container } = renderFinances((props) => <RecouvrementPage {...props} echeanceId={KOFFI} />);
    expect(await screen.findByRole('heading', { name: 'Recouvrement, Koffi Adjovi' })).toBeTruthy();
    const kpis = screen.getByRole('region', { name: 'Chiffres du dossier' });
    const text = norm(kpis.textContent);
    expect(text).toContain('850 €');
    expect(text).toContain('145,70 €');
    expect(text).toContain('Dont 15 € déjà réglés');
    expect(text).toContain('980,70 €');
    expect(text).toContain('11 jours');
    const steps = screen.getAllByRole('listitem').filter((item) => item.getAttribute('aria-current') === 'step');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.textContent).toContain('Commandement de payer');
    const carnet = screen.getByRole('table', { name: 'Carnet des actes' });
    expect(within(carnet).getAllByRole('row')).toHaveLength(5);
    expect(norm(carnet.textContent)).toContain('124,50 €');
    expect(norm(screen.getByRole('heading', { name: 'Facture des frais' }).closest('div')?.parentElement?.textContent ?? '')).toContain('FA-2026-0025');
    await expectNoA11yViolations(container);
  });

  it('ajoute une diligence au carnet, avec validation des champs', async () => {
    const { source } = renderFinances((props) => <RecouvrementPage {...props} echeanceId={KOFFI} />);
    await screen.findByRole('heading', { name: 'Recouvrement, Koffi Adjovi' });
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une diligence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter une diligence' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au carnet' }));
    expect(within(dialog).getByText('Décrivez l’acte.')).toBeTruthy();
    expect(within(dialog).getByText('Indiquez l’intervenant.')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Signification');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Intervenant' }), 'SCP Agbodjo');
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Coût, €' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Coût, €' }), '45');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au carnet' }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.dossiers[0]?.actes.at(-1)).toMatchObject({ libelle: 'Signification', cout: 4500 });
    });
    expect(await screen.findByText(/non refacturés/)).toBeTruthy();
  });

  it('facture ensuite les frais restants', async () => {
    const source = createDemoFinancesSource();
    await source.dispatch({ type: 'addDiligence', requestKey: 'cle-diligence-1', dossierId: 'dos-rc-2026-0011', date: '2026-11-13', kind: 'autre', libelle: 'Signification', intervenant: 'SCP Agbodjo', cout: 4500 });
    renderFinances((props) => <RecouvrementPage {...props} echeanceId={KOFFI} />, source);
    await screen.findByRole('heading', { name: 'Recouvrement, Koffi Adjovi' });
    await userEvent.click(screen.getByRole('button', { name: 'Facturer les frais' }));
    const dialog = await screen.findByRole('dialog', { name: 'Facturer les frais au locataire' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre la facture' }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.factures.some((facture) => facture.numero === 'FA-2026-0026')).toBe(true);
    });
  });

  it('propose un échéancier depuis la page', async () => {
    renderFinances((props) => <RecouvrementPage {...props} echeanceId={KOFFI} />);
    await screen.findByRole('heading', { name: 'Recouvrement, Koffi Adjovi' });
    await userEvent.click(screen.getByRole('button', { name: 'Proposer un échéancier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Proposer un échéancier' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Proposer l’échéancier' }));
    expect(await screen.findByRole('list', { name: 'Échéancier proposé' })).toBeTruthy();
  });

  it('propose d’ouvrir un dossier quand il n’y en a pas', async () => {
    const { source } = renderFinances((props) => <RecouvrementPage {...props} echeanceId="ech-2026-11-clarisse-hounkpatin" />);
    expect(await screen.findByText('Aucun dossier de recouvrement')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le dossier' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).dossiers).toHaveLength(2);
    });
    expect(await screen.findByRole('heading', { name: 'Recouvrement, Clarisse Hounkpatin' })).toBeTruthy();
    expect(await screen.findByText('Aucun acte au carnet')).toBeTruthy();
  });

  it('signale un impayé introuvable', async () => {
    renderFinances((props) => <RecouvrementPage {...props} echeanceId="inconnue" />);
    expect(await screen.findByText('Impayé introuvable')).toBeTruthy();
  });
});
