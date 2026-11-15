import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { BilanPage } from './BilanPage';
import { dismissFlash } from './flash';
import { ImportBancairePage } from './ImportBancairePage';
import { PretsPage } from './PretsPage';
import { inputValue, norm, renderFinances, rowAt, snapshotOf } from './testing/render';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  dismissFlash();
});

describe('BilanPage', () => {
  it('chiffre le bilan 2026 au régime réel et signale les justificatifs manquants', async () => {
    const { container } = renderFinances((props) => <BilanPage {...props} />);
    expect(await screen.findByRole('heading', { name: 'Bilan 2026' })).toBeTruthy();
    const kpis = norm(screen.getByRole('region', { name: 'Résultat de l’année' }).textContent);
    expect(kpis).toContain('20 900 €');
    expect(kpis).toContain('4 215 €');
    expect(kpis).toContain('16 685 €');
    expect(screen.getByText('3 factures manquantes')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('simule un autre régime sans recharger : micro-foncier applique 30 % d’abattement', async () => {
    renderFinances((props) => <BilanPage {...props} />);
    await screen.findByRole('heading', { name: 'Bilan 2026' });
    await userEvent.click(screen.getByRole('radio', { name: 'Micro-foncier' }));
    const kpis = norm(screen.getByRole('region', { name: 'Résultat de l’année' }).textContent);
    expect(kpis).toContain('6 270 €');
    expect(kpis).toContain('14 630 €');
    expect(screen.getByText('Abattement forfaitaire de 30 %')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Micro-BIC' }));
    expect(norm(screen.getByRole('region', { name: 'Résultat de l’année' }).textContent)).toContain('10 450 €');
  });

  it('change d’année et signale une année sans bilan', async () => {
    renderFinances((props) => <BilanPage {...props} />);
    await screen.findByRole('heading', { name: 'Bilan 2026' });
    await userEvent.click(screen.getByRole('combobox', { name: /Année/ }));
    await userEvent.click(await screen.findByRole('option', { name: '2025' }));
    expect(screen.getByRole('heading', { name: 'Bilan 2025' })).toBeTruthy();
  });

  it('exporte le bilan en CSV', async () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderFinances((props) => <BilanPage {...props} />);
    await screen.findByRole('heading', { name: 'Bilan 2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('PretsPage', () => {
  it('synthétise les prêts en cours et liste le tableau avec l’avancement', async () => {
    const { container } = renderFinances((props) => <PretsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Prêts immobiliers' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2);
    const kpis = norm(screen.getByRole('region', { name: 'Synthèse des prêts' }).textContent);
    expect(kpis).toContain('214 380 €');
    expect(kpis).toContain('sur 275 000 € empruntés');
    expect(kpis).toContain('1 642 € par mois');
    expect(kpis).toContain('4 918 €');
    expect(norm(rowAt(table, 1).textContent)).toContain('1,45 %');
    expect(rowAt(table, 1).textContent).toContain('06/2041');
    expect(screen.getByRole('img', { name: 'Avancement Les Tilleuls : 26 %' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('bascule sur les prêts remboursés', async () => {
    renderFinances((props) => <PretsPage {...props} />);
    await screen.findByRole('table', { name: 'Prêts immobiliers' });
    await userEvent.click(screen.getByRole('tab', { name: /Remboursés/ }));
    const table = screen.getByRole('table', { name: 'Prêts immobiliers' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(table.textContent).toContain('Studio C2');
  });

  it('ajoute un prêt après validation des champs', async () => {
    const { source } = renderFinances((props) => <PretsPage {...props} />);
    await screen.findByRole('table', { name: 'Prêts immobiliers' });
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau prêt' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nouveau prêt' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le prêt' }));
    expect(within(dialog).getByText('Choisissez le bien financé.')).toBeTruthy();
    expect(within(dialog).getByText('Indiquez la banque.')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Les Tilleuls' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Banque *' }), 'Banque Atlantique');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Montant emprunté, € *' }), '50000');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Taux, %' }), '2,5');
    await userEvent.type(within(dialog).getByLabelText('Fin du prêt *'), '2036-01');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Mensualité, €' }), '480');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Capital restant dû, € *' }), '60000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le prêt' }));
    expect(within(dialog).getByText('Le capital restant dû dépasse le montant emprunté.')).toBeTruthy();
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Capital restant dû, € *' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Capital restant dû, € *' }), '45000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le prêt' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).prets.find((pret) => pret.banque === 'Banque Atlantique')).toMatchObject({ emprunte: 5000000, tauxBp: 250, restantDu: 4500000, statut: 'en_cours' });
    });
  });

  it('enregistre un remboursement anticipé et refuse un dépassement', async () => {
    const { source } = renderFinances((props) => <PretsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Prêts immobiliers' });
    await userEvent.click(within(rowAt(table, 2)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remboursement anticipé' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remboursement anticipé' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Montant remboursé, €' }), '90000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le remboursement' }));
    expect(within(dialog).getByText('Le remboursement dépasse le capital restant dû.')).toBeTruthy();
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Montant remboursé, €' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Montant remboursé, €' }), '1500,50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le remboursement' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).prets.find((pret) => pret.id === 'pret-residence-du-parc')?.restantDu).toBe(8150000 - 150050);
    });
  });

  it('affiche l’échéancier estimé puis exact après import', async () => {
    renderFinances((props) => <PretsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Prêts immobiliers' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Échéancier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Échéancier, Les Tilleuls' });
    expect(dialog.textContent).toContain('Estimation');
    expect(within(dialog).getAllByRole('row').length).toBe(13);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminé' }));

    await userEvent.click(screen.getByRole('button', { name: 'Importer un échéancier' }));
    const importDialog = await screen.findByRole('dialog', { name: 'Importer un échéancier' });
    await userEvent.type(within(importDialog).getByRole('textbox', { name: 'Échéancier' }), 'n’importe quoi');
    await userEvent.click(within(importDialog).getByRole('button', { name: 'Importer' }));
    expect(await within(importDialog).findByText('Import impossible')).toBeTruthy();
    await userEvent.clear(within(importDialog).getByRole('textbox', { name: 'Échéancier' }));
    await userEvent.click(within(importDialog).getByRole('textbox', { name: 'Échéancier' }));
    await userEvent.paste('15/12/2026;1012,00;160,89;851,11;1 320 000,00\n15/01/2027;1012,00;160,00;852,00;1 319 148,00');
    await userEvent.click(within(importDialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('Échéancier importé : 2 échéances.')).toBeTruthy();
    await userEvent.click(within(rowAt(screen.getByRole('table', { name: 'Prêts immobiliers' }), 1)).getByRole('button', { name: 'Échéancier' }));
    const exact = await screen.findByRole('dialog', { name: 'Échéancier, Les Tilleuls' });
    expect(exact.textContent).toContain('importé depuis la banque');
    expect(within(exact).getAllByRole('row')).toHaveLength(3);
  });

  it('archive un prêt et le supprime seulement après confirmation', async () => {
    const { source } = renderFinances((props) => <PretsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Prêts immobiliers' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).prets.find((pret) => pret.id === 'pret-les-tilleuls')?.statut).toBe('archive');
    });
    await userEvent.click(within(rowAt(screen.getByRole('table', { name: 'Prêts immobiliers' }), 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce prêt ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect((await snapshotOf(source)).prets.find((pret) => pret.id === 'pret-residence-du-parc')?.supprime).toBe(false);
    await userEvent.click(within(rowAt(screen.getByRole('table', { name: 'Prêts immobiliers' }), 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer le prêt' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).prets.find((pret) => pret.id === 'pret-residence-du-parc')?.supprime).toBe(true);
    });
  });
});

describe('ImportBancairePage', () => {
  it('liste les opérations à rapprocher avec leur correspondance proposée', async () => {
    const { container } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /À rapprocher/ }).textContent).toContain('4');
    expect(norm(rowAt(table, 1).textContent)).toContain('VIR KOFFI ADJOVI NOV');
    expect(norm(rowAt(table, 1).textContent)).toContain('+850 €');
    expect(rowAt(table, 1).textContent).toContain('Loyer de novembre, Apt A1');
    expect(within(rowAt(table, 1)).getByRole('button', { name: 'Valider' })).toBeTruthy();
    expect(within(rowAt(table, 4)).getByRole('button', { name: 'Classer' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('valide une correspondance : l’échéance est soldée et l’opération passe en rapprochées', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Valider' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-koffi')?.statut).toBe('rapprochee');
    });
    const data = await snapshotOf(source);
    expect(data.echeances.find((echeance) => echeance.id === 'ech-2026-11-koffi-adjovi')?.paye).toBe(85000);
    expect(screen.getByRole('tab', { name: /À rapprocher/ }).textContent).toContain('3');
  });

  it('ouvre le choix d’écriture quand la proposition ne tient plus, puis rapproche', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    const row = rowAt(table, 2);
    expect(row.textContent).toContain('VIR SOSSOU NADEGE');
    await userEvent.click(within(row).getByRole('button', { name: 'Ouvrir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choisir une écriture' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rapprocher' }));
    expect(within(dialog).getByText('Choisissez une échéance.')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Échéance à régler/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Clarisse Hounkpatin/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rapprocher' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-sossou')?.statut).toBe('rapprochee');
    });
  });

  it('classe un débit en dépense via le formulaire de dépense', async () => {
    const { navigate } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(within(rowAt(table, 3)).getByRole('button', { name: 'Classer' }));
    expect(navigate).toHaveBeenCalledWith('/finances/depenses/nouvelle?banque=bnk-edf');
  });

  it('ignore une opération puis la restaure depuis les archives', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(within(rowAt(table, 4)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Ignorer' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-quincaillerie')?.statut).toBe('archivee');
    });
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const archives = screen.getByRole('table', { name: 'Opérations bancaires' });
    expect(within(archives).getAllByRole('row').slice(1)).toHaveLength(2);
    await userEvent.click(within(archives).getAllByRole('button', { name: 'Restaurer' })[0] ?? archives);
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.filter((ligne) => ligne.statut === 'archivee')).toHaveLength(1);
    });
  });

  it('divise une opération en deux parts', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    const table = await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(within(rowAt(table, 3)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Diviser l’opération' }));
    const dialog = await screen.findByRole('dialog', { name: 'Diviser l’opération' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Première part, €' }), '60');
    expect(inputValue(within(dialog).getByRole('textbox', { name: 'Seconde part, €' }))).toBe('36');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Diviser' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.filter((ligne) => ligne.libelle.startsWith('PRLV EDF'))).toHaveLength(2);
    });
  });

  it('importe un relevé : doublons ignorés et lignes invalides signalées', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(screen.getByRole('button', { name: 'Nouvel import' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nouvel import' });
    await userEvent.click(within(dialog).getByRole('textbox', { name: 'Relevé' }));
    await userEvent.paste('12/11/2026;VIR KOFFI ADJOVI NOV;850,00\n13/11/2026;VIR HOUNKPATIN CLARISSE;210,00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await screen.findByText('1 opération importée. 1 doublon ignoré.')).toBeTruthy();
    expect((await snapshotOf(source)).lignesBancaires.filter((ligne) => ligne.statut === 'a_rapprocher')).toHaveLength(5);
  });

  it('refuse un relevé invalide sans rien importer', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(screen.getByRole('button', { name: 'Nouvel import' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nouvel import' });
    await userEvent.click(within(dialog).getByRole('textbox', { name: 'Relevé' }));
    await userEvent.paste('12/11/2026;VIR;abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importer' }));
    expect(await within(dialog).findByText(/Ligne 1 : attendu/)).toBeTruthy();
    expect((await snapshotOf(source)).lignesBancaires).toHaveLength(7);
  });

  it('active et désactive une automatisation', async () => {
    const { source } = renderFinances((props) => <ImportBancairePage {...props} />);
    await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(screen.getByRole('button', { name: 'Automatisations' }));
    const dialog = await screen.findByRole('dialog', { name: 'Automatisations' });
    const toggle = within(dialog).getByRole('switch', { name: /Ignorer les frais de tenue de compte/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(toggle);
    await waitFor(async () => {
      expect((await snapshotOf(source)).automatisations.find((auto) => auto.id === 'auto-frais')?.active).toBe(true);
    });
  });

  it('filtre les dépenses avec la pastille et la recherche', async () => {
    renderFinances((props) => <ImportBancairePage {...props} />);
    await screen.findByRole('table', { name: 'Opérations bancaires' });
    await userEvent.click(screen.getByRole('button', { name: 'Dépenses' }));
    expect(within(screen.getByRole('table', { name: 'Opérations bancaires' })).getAllByRole('row').slice(1)).toHaveLength(2);
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'edf');
    expect(within(screen.getByRole('table', { name: 'Opérations bancaires' })).getAllByRole('row').slice(1)).toHaveLength(1);
  });
});
