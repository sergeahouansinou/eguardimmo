import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { AcompteFormPage } from './AcompteFormPage';
import { DepenseFormPage } from './DepenseFormPage';
import { dismissFlash } from './flash';
import { OperationsPage } from './OperationsPage';
import { PaiementFormPage } from './PaiementFormPage';
import { RegularisationPage } from './RegularisationPage';
import { resteDu } from './derive';
import { echeanceOf, inputValue, norm, renderFinances, rowAt, snapshotOf } from './testing/render';

const KOFFI = 'ech-2026-11-koffi-adjovi';

afterEach(() => {
  vi.restoreAllMocks();
  dismissFlash();
});

describe('OperationsPage', () => {
  it('résume le mois et liste d’abord ce qui reste à encaisser', async () => {
    const { container } = renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    const kpis = norm(screen.getByRole('region', { name: 'Chiffres de la période' }).textContent);
    expect(kpis).toContain('4 180 €');
    expect(kpis).toContain('sur 5 300 € attendus');
    expect(kpis).toContain('285 €');
    expect(kpis).toContain('3 895 €');
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(4);
    expect(norm(rowAt(table, 1).textContent)).toContain('Koffi Adjovi');
    expect(rowAt(table, 1).textContent).toContain('Retard, 12 jours');
    expect(norm(screen.getByText(/Reste dû sur la liste/).textContent)).toContain('1 120 €');
    await expectNoA11yViolations(container);
  });

  it('relance un impayé en une action et affiche la confirmation', async () => {
    const { source } = renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    const before = (await snapshotOf(source)).relances.length;
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Relancer' }));
    expect(await screen.findByText('Relance envoyée et tracée.')).toBeTruthy();
    expect((await snapshotOf(source)).relances).toHaveLength(before + 1);
  });

  it('reporte un trop-perçu sur l’échéance suivante', async () => {
    const { source } = renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    const row = within(table).getAllByRole('row').find((item) => item.textContent.includes('Marc Dossou'));
    if (!row) throw new Error('ligne Marc absente');
    expect(row.textContent).toContain('Trop perçu');
    await userEvent.click(within(row).getByRole('button', { name: 'Reporter' }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.echeances.find((echeance) => echeance.id === 'ech-2026-12-marc-dossou')?.paye).toBe(5000);
      expect(resteDu(echeanceOf(data, 'ech-2026-11-marc-dossou'))).toBe(0);
    });
  });

  it('ouvre l’enregistrement d’un paiement prérempli', async () => {
    const { navigate } = renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    const row = within(table).getAllByRole('row').find((item) => item.textContent.includes('Ibrahim'));
    if (!row) throw new Error('ligne Ibrahim absente');
    await userEvent.click(within(row).getByRole('button', { name: 'Enregistrer' }));
    expect(navigate).toHaveBeenCalledWith('/finances/encaissements/nouveau?echeance=ech-2026-11-ibrahim-yao');
  });

  it('filtre par recherche, inverse le tri et efface les filtres', async () => {
    renderFinances((props) => <OperationsPage {...props} />);
    await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'zzz');
    expect(screen.getByText('Aucune échéance ne correspond aux filtres')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(within(screen.getByRole('table', { name: 'Échéances à encaisser' })).getAllByRole('row').slice(1)).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: /Inverser le tri/ }));
    expect(within(screen.getByRole('table', { name: 'Échéances à encaisser' })).getAllByRole('row')[1]?.textContent).toBeTruthy();
  });

  it('modifie les lignes sélectionnées : report de la date d’échéance', async () => {
    const { source } = renderFinances((props) => <OperationsPage {...props} />);
    await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Koffi Adjovi, Loyer novembre 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Modifier les lignes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier les lignes' });
    const date = within(dialog).getByLabelText('Nouvelle échéance');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-20');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Appliquer' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).echeances.find((echeance) => echeance.id === KOFFI)?.echeance).toBe('2026-11-20');
    });
  });

  it('annule un avis d’échéance seulement après confirmation et pas s’il a été payé', async () => {
    const { source } = renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler l’avis d’échéance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler l’avis d’échéance ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect((await snapshotOf(source)).echeances.find((echeance) => echeance.id === KOFFI)?.statut).toBe('active');
    await userEvent.click(within(rowAt(screen.getByRole('table', { name: 'Échéances à encaisser' }), 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler l’avis d’échéance' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler l’avis' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).echeances.find((echeance) => echeance.id === KOFFI)?.statut).toBe('annulee');
    });
  });

  it('affiche les paiements encaissés puis les dépenses du mois', async () => {
    renderFinances((props) => <OperationsPage {...props} />);
    await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.click(screen.getByRole('tab', { name: /Encaissé/ }));
    expect(within(screen.getByRole('table', { name: 'Encaissements' })).getAllByRole('row').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('tab', { name: /Dépenses/ }));
    const table = screen.getByRole('table', { name: 'Dépenses' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(3);
    expect(norm(table.textContent)).toContain('Chaudières Services');
  });

  it('annule une dépense après confirmation sans la supprimer', async () => {
    const { source } = renderFinances((props) => <OperationsPage {...props} />);
    await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.click(screen.getByRole('tab', { name: /Dépenses/ }));
    const table = screen.getByRole('table', { name: 'Dépenses' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler la dépense' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Annuler la dépense/ }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.depenses).toHaveLength(3);
      expect(data.depenses.filter((depense) => depense.annulee)).toHaveLength(1);
    });
  });

  it('refuse un justificatif de format ou de taille invalide', async () => {
    renderFinances((props) => <OperationsPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Échéances à encaisser' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Joindre un justificatif' }));
    const input = screen.getByLabelText('Justificatif à joindre');
    await userEvent.upload(input, new File(['x'], 'virus.exe', { type: 'application/octet-stream' }), { applyAccept: false });
    expect(await screen.findByText('Format non pris en charge : PDF ou image uniquement.')).toBeTruthy();
  });
});

describe('PaiementFormPage', () => {
  it('préremplit le reste dû et solde l’échéance', async () => {
    const { source, navigate, container } = renderFinances((props) => <PaiementFormPage {...props} echeanceId={KOFFI} />);
    const montant = await screen.findByRole('textbox', { name: 'Montant reçu, €' });
    expect(inputValue(montant)).toBe('850');
    expect(screen.getByText('Le reste dû sera de 0 €.')).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/finances'); });
    expect(resteDu(echeanceOf(await snapshotOf(source), KOFFI))).toBe(0);
  });

  it('un paiement partiel annonce le reste dû et mène au reçu', async () => {
    const { source, navigate } = renderFinances((props) => <PaiementFormPage {...props} echeanceId={KOFFI} />);
    const montant = await screen.findByRole('textbox', { name: 'Montant reçu, €' });
    await userEvent.clear(montant);
    await userEvent.type(montant, '300');
    expect(screen.getByText('Le reste dû sera de 550 €.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const recu = (await snapshotOf(source)).recus.find((item) => item.numero === 'RC-2026-0188');
    expect(navigate).toHaveBeenCalledWith(`/finances/recus/${recu?.id ?? ''}`);
  });

  it('refuse un montant invalide et une date future sans rien enregistrer', async () => {
    const { source } = renderFinances((props) => <PaiementFormPage {...props} echeanceId={KOFFI} />);
    const montant = await screen.findByRole('textbox', { name: 'Montant reçu, €' });
    await userEvent.clear(montant);
    await userEvent.type(montant, '12,345');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    expect(screen.getByText('Montant reçu : montant invalide (ex. 850 ou 850,50).')).toBeTruthy();
    await userEvent.clear(montant);
    await userEvent.type(montant, '100');
    const date = screen.getByLabelText('Date du paiement');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-12-01');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    expect(await screen.findByText(/futur/)).toBeTruthy();
    expect((await snapshotOf(source)).paiements).toHaveLength(5);
  });

  it('signale une échéance introuvable', async () => {
    renderFinances((props) => <PaiementFormPage {...props} echeanceId="inconnue" />);
    expect(await screen.findByText('Échéance introuvable')).toBeTruthy();
  });
});

describe('AcompteFormPage', () => {
  it('enregistre un acompte sur loyer et émet un reçu numéroté', async () => {
    const { source, navigate, container } = renderFinances((props) => <AcompteFormPage {...props} bailId="bl-2023-0007" />);
    expect(await screen.findByText('Reçu d’acompte RC-2026-0188')).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Montant reçu, €' }), '300');
    expect(screen.getByText('Il restera 550 € à régler.')).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’acompte' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const data = await snapshotOf(source);
    expect(data.recus.some((recu) => recu.numero === 'RC-2026-0188' && recu.montant === 30000)).toBe(true);
  });

  it('exige un montant avant d’enregistrer', async () => {
    const { source } = renderFinances((props) => <AcompteFormPage {...props} bailId="bl-2023-0007" />);
    await screen.findByText('Reçu d’acompte RC-2026-0188');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’acompte' }));
    expect(screen.getByText(/saisissez un montant/)).toBeTruthy();
    expect((await snapshotOf(source)).recus).toHaveLength(1);
  });

  it('signale un bail introuvable', async () => {
    renderFinances((props) => <AcompteFormPage {...props} bailId="inconnu" />);
    expect(await screen.findByText('Bail introuvable')).toBeTruthy();
  });
});

describe('DepenseFormPage', () => {
  it('valide puis enregistre une dépense', async () => {
    const { source, navigate, container } = renderFinances((props) => <DepenseFormPage {...props} />);
    expect(await screen.findByRole('heading', { name: 'Ajouter une dépense' })).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer la dépense' }));
    expect(screen.getByText('Choisissez le bien concerné.')).toBeTruthy();
    await userEvent.click(screen.getByRole('combobox', { name: /Bien/ }));
    await userEvent.click((await screen.findAllByRole('option'))[0] ?? container);
    await userEvent.type(screen.getByRole('textbox', { name: 'Montant TTC, €' }), '42');
    await userEvent.click(screen.getByRole('combobox', { name: /Payé à/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Quincaillerie du Port' }));
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/finances'); });
    expect((await snapshotOf(source)).depenses).toHaveLength(4);
  });

  it('modifie une dépense existante sans en créer une seconde', async () => {
    const { source } = renderFinances((props) => <DepenseFormPage {...props} depenseId="dep-ampoules" />);
    expect(await screen.findByRole('heading', { name: 'Modifier la dépense' })).toBeTruthy();
    const montant = await screen.findByRole('textbox', { name: 'Montant TTC, €' });
    await userEvent.clear(montant);
    await userEvent.type(montant, '35');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).depenses.find((depense) => depense.id === 'dep-ampoules')?.montantTtc).toBe(3500);
    });
    expect((await snapshotOf(source)).depenses).toHaveLength(3);
  });

  it('préremplit depuis une opération bancaire et la marque rapprochée', async () => {
    const { source } = renderFinances((props) => <DepenseFormPage {...props} ligneBancaireId="bnk-quincaillerie" />);
    const montant = await screen.findByRole('textbox', { name: 'Montant TTC, €' });
    expect(inputValue(montant)).toBe('42');
    await userEvent.click(screen.getByRole('combobox', { name: /Bien/ }));
    await userEvent.click((await screen.findAllByRole('option'))[0] ?? montant);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).lignesBancaires.find((ligne) => ligne.id === 'bnk-quincaillerie')?.statut).toBe('rapprochee');
    });
  });

  it('signale une dépense introuvable', async () => {
    renderFinances((props) => <DepenseFormPage {...props} depenseId="inconnue" />);
    expect(await screen.findByText('Dépense introuvable')).toBeTruthy();
  });
});

describe('RegularisationPage', () => {
  it('enregistre un brouillon puis émet le décompte après confirmation', async () => {
    const { source, container } = renderFinances((props) => <RegularisationPage {...props} />);
    expect(await screen.findByText('Solde à réclamer')).toBeTruthy();
    expect(norm(container.textContent)).toContain('312 €');
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le brouillon/ }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).regularisations).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Émettre le décompte' }));
    const dialog = await screen.findByRole('dialog', { name: 'Émettre le décompte ?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre le décompte' }));
    await waitFor(async () => {
      const data = await snapshotOf(source);
      expect(data.regularisations).toHaveLength(1);
      expect(data.regularisations[0]?.statut).toBe('emise');
      expect(data.factures.find((facture) => facture.objet === 'Régularisation des charges 2026')?.montantTtc).toBe(31200);
    });
  });

  it('refuse une période inversée', async () => {
    const { source } = renderFinances((props) => <RegularisationPage {...props} />);
    const fin = await screen.findByLabelText('Fin de période *');
    await userEvent.clear(fin);
    await userEvent.type(fin, '2025-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Émettre le décompte' }));
    expect(screen.getByText('La fin de période doit suivre le début.')).toBeTruthy();
    expect((await snapshotOf(source)).regularisations).toHaveLength(0);
  });
});
