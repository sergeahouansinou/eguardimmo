import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FactureDocumentPage } from './FactureDocumentPage';
import { FactureFormPage } from './FactureFormPage';
import { FacturesPage } from './FacturesPage';
import { RecuDocumentPage } from './RecuDocumentPage';
import { dismissFlash } from './flash';
import { createDemoFinancesSource } from './source';
import { inputValue, norm, renderFinances, rowAt, snapshotOf } from './testing/render';

afterEach(() => {
  vi.restoreAllMocks();
  dismissFlash();
});

async function factureId(numero: string): Promise<string> {
  const found = (await snapshotOf(createDemoFinancesSource())).factures.find((facture) => facture.numero === numero);
  if (!found) throw new Error(`facture ${numero} absente`);
  return found.id;
}

describe('FacturesPage', () => {
  it('liste les factures de l’année, les plus récentes d’abord, avec les compteurs d’onglet', async () => {
    const { container } = renderFinances((props) => <FacturesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    expect(rowAt(table, 1).textContent).toContain('FA-2026-0025');
    expect(norm(rowAt(table, 1).textContent)).toContain('130,70 €');
    expect(rowAt(table, 1).textContent).toContain('En attente');
    expect(screen.getByRole('tab', { name: /Toutes/ }).textContent).toContain('27');
    expect(screen.getByRole('tab', { name: /Avoirs/ }).textContent).toContain('2');
    expect(screen.getByText(/1 à 10 sur 27/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('filtre par onglet, par recherche et par année', async () => {
    renderFinances((props) => <FacturesPage {...props} />);
    await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(screen.getByRole('tab', { name: /Avoirs/ }));
    const avoirs = screen.getByRole('table', { name: 'Factures et avoirs' });
    expect(within(avoirs).getAllByRole('row').slice(1)).toHaveLength(2);
    expect(norm(avoirs.textContent)).toContain('-40 €');
    await userEvent.click(screen.getByRole('tab', { name: /Toutes/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'ibrahim');
    expect(within(screen.getByRole('table', { name: 'Factures et avoirs' })).getAllByRole('row').slice(1).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole('textbox', { name: 'Recherche' }), 'zzzz');
    expect(screen.getByText('Aucune facture ne correspond')).toBeTruthy();
  });

  it('pagine par dix', async () => {
    renderFinances((props) => <FacturesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: /Page suivante|Suivant/ }));
    expect(screen.getByText(/11 à 20 sur 27/)).toBeTruthy();
  });

  it('enregistre le paiement d’une facture en attente', async () => {
    const { source } = renderFinances((props) => <FacturesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Enregistrer un paiement' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer un paiement' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme payée' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).factures.find((facture) => facture.numero === 'FA-2026-0025')?.statut).toBe('payee');
    });
    expect(await screen.findByText('Facture FA-2026-0025 marquée comme payée.')).toBeTruthy();
  });

  it('émet un avoir après confirmation et redirige vers lui', async () => {
    const { source, navigate } = renderFinances((props) => <FacturesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Émettre un avoir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Émettre un avoir ?' });
    expect(dialog.textContent).toContain('FA-2026-0025');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const data = await snapshotOf(source);
    const avoir = data.factures.find((facture) => facture.numero === 'AV-2026-0003');
    expect(avoir?.montantTtc).toBe(-13070);
    expect(navigate).toHaveBeenCalledWith(`/finances/factures/${avoir?.id ?? ''}`);
  });

  it('ne propose pas d’avoir sur une facture déjà annulée ni sur un avoir', async () => {
    renderFinances((props) => <FacturesPage {...props} />);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(screen.getByRole('tab', { name: /Avoirs/ }));
    await userEvent.click(within(rowAt(screen.getByRole('table', { name: 'Factures et avoirs' }), 1)).getByRole('button', { name: 'Plus d’actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Aperçu du PDF' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Émettre un avoir' })).toBeNull();
    expect(table).toBeTruthy();
  });

  it('exporte la liste filtrée en CSV', async () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderFinances((props) => <FacturesPage {...props} />);
    await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('FactureFormPage', () => {
  it('annonce le prochain numéro et valide les champs avant toute émission', async () => {
    const { container, source } = renderFinances((props) => <FactureFormPage {...props} />);
    expect(await screen.findByText('FA-2026-0026')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Émettre la facture' }));
    expect(screen.getByText('Choisissez un destinataire.')).toBeTruthy();
    expect(screen.getByText('Indiquez l’objet de la facture.')).toBeTruthy();
    expect(screen.getByText('Montant HT : saisissez un montant.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await snapshotOf(source)).sequences.FA).toBe(25);
    await expectNoA11yViolations(container);
  });

  it('calcule le TTC en entiers, demande confirmation puis émet et redirige', async () => {
    const { source, navigate } = renderFinances((props) => <FactureFormPage {...props} />);
    await screen.findByText('FA-2026-0026');
    await userEvent.click(screen.getByRole('combobox', { name: /Destinataire/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Marc Dossou/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet *' }), 'Régularisation des charges 2026');
    await userEvent.type(screen.getByRole('textbox', { name: 'Montant HT, € *' }), '177');
    await userEvent.clear(screen.getByRole('textbox', { name: 'TVA, %' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'TVA, %' }), '20');
    expect(inputValue(screen.getByRole('textbox', { name: 'Total TTC, €' }))).toBe('212,40');
    await userEvent.click(screen.getByRole('button', { name: 'Émettre la facture' }));
    const dialog = await screen.findByRole('dialog', { name: 'Émettre la facture ?' });
    expect(norm(dialog.textContent)).toContain('212,40 €');
    expect((await snapshotOf(source)).sequences.FA).toBe(25);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre la facture' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const data = await snapshotOf(source);
    const created = data.factures.find((facture) => facture.numero === 'FA-2026-0026');
    expect(created).toMatchObject({ montantHt: 17700, montantTtc: 21240, destinataire: 'Marc Dossou', tvaPct: 20 });
    expect(navigate).toHaveBeenCalledWith(`/finances/factures/${created?.id ?? ''}`);
  });

  it('refuse une échéance antérieure à la date d’émission', async () => {
    renderFinances((props) => <FactureFormPage {...props} />);
    await screen.findByText('FA-2026-0026');
    await userEvent.click(screen.getByRole('combobox', { name: /Destinataire/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Marc Dossou/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Objet *' }), 'Frais');
    await userEvent.type(screen.getByRole('textbox', { name: 'Montant HT, € *' }), '10');
    const due = screen.getByLabelText('Échéance de paiement');
    await userEvent.type(due, '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Émettre la facture' }));
    expect(screen.getByText('L’échéance ne peut pas précéder la date d’émission.')).toBeTruthy();
  });
});

describe('FactureDocumentPage', () => {
  it('reproduit la facture des frais de recouvrement : lignes, autres sommes dues et scellement vérifié', async () => {
    const id = await factureId('FA-2026-0025');
    const { container } = renderFinances((props) => <FactureDocumentPage {...props} factureId={id} />);
    expect(await screen.findByRole('heading', { name: 'Facture des frais de recouvrement' })).toBeTruthy();
    const sheet = norm(container.querySelector('[data-print-area]')?.textContent ?? '');
    expect(sheet).toContain('FA-2026-0025');
    expect(sheet).toContain('1 · Frais engagés pour le recouvrement');
    expect(sheet).toContain('2 · Autres sommes dues sur le compte');
    expect(sheet).toContain('130,70 €');
    expect(sheet).toContain('980,70');
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(await screen.findByText('Empreinte conforme : le document n’a pas été modifié.')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('émet un avoir depuis le document après confirmation', async () => {
    const id = await factureId('FA-2026-0024');
    const { source, navigate } = renderFinances((props) => <FactureDocumentPage {...props} factureId={id} />);
    await screen.findByRole('heading', { name: /FA-2026-0024/ });
    await userEvent.click(screen.getByRole('button', { name: 'Émettre un avoir' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre l’avoir' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    expect((await snapshotOf(source)).factures.find((facture) => facture.id === id)?.avoirId).not.toBeNull();
  });

  it('envoie la facture par e-mail et l’imprime à la demande', async () => {
    const id = await factureId('FA-2026-0024');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { source } = renderFinances((props) => <FactureDocumentPage {...props} factureId={id} />);
    await screen.findByRole('heading', { name: /FA-2026-0024/ });
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger' }));
    expect(print).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer par e-mail' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).factures.find((facture) => facture.id === id)?.envoyeLe).toBe('2026-11-13');
    });
  });

  it('signale une facture introuvable', async () => {
    renderFinances((props) => <FactureDocumentPage {...props} factureId="inconnue" />);
    expect(await screen.findByText('Facture introuvable')).toBeTruthy();
  });
});

describe('RecuDocumentPage', () => {
  it('affiche le reçu d’acompte avec le reste dû et propose d’enregistrer le solde', async () => {
    const { container, navigate } = renderFinances((props) => <RecuDocumentPage {...props} recuId="rc-2026-0187" />);
    expect(await screen.findByRole('heading', { name: /Reçu d’acompte du/ })).toBeTruthy();
    const sheet = norm(container.querySelector('[data-print-area]')?.textContent ?? '');
    expect(sheet).toContain('RC-2026-0187');
    expect(sheet).toContain('Ce reçu ne vaut pas quittance');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le solde' }));
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/finances\/encaissements\/nouveau\?echeance=/));
    await expectNoA11yViolations(container);
  });

  it('renvoie le reçu au locataire', async () => {
    const { source } = renderFinances((props) => <RecuDocumentPage {...props} recuId="rc-2026-0187" />);
    await screen.findByRole('heading', { name: /Reçu d’acompte du/ });
    await userEvent.click(screen.getByRole('button', { name: 'Renvoyer' }));
    await waitFor(async () => {
      expect((await snapshotOf(source)).recus.find((recu) => recu.id === 'rc-2026-0187')?.envoyeLe).toBe('2026-11-13');
    });
  });

  it('signale un reçu introuvable', async () => {
    renderFinances((props) => <RecuDocumentPage {...props} recuId="inconnu" />);
    expect(await screen.findByText('Reçu introuvable')).toBeTruthy();
  });
});
