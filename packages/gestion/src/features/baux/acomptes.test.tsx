import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FROZEN_NOW, norm, renderLot } from '../../../test/lots';
import { createDemoFinances } from '../finances/demo';
import { leaseAcomptes } from './acomptes';
import { BailEcheancierPage } from './BailEcheancierPage';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function sectionOf(heading: HTMLElement): HTMLElement {
  const section = heading.closest('section');
  if (!section) throw new Error('Section introuvable');
  return section;
}

describe('leaseAcomptes', () => {
  it('relie l’acompte de novembre au reçu et à l’échéance qu’il impute', () => {
    const result = leaseAcomptes(createDemoFinances(), 'BL-2025-0002');
    expect(result.bailId).toBe('bl-2025-0002');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      nature: 'acompte_loyer',
      montant: 72000,
      recuId: 'rc-2026-0187',
      recuNumero: 'RC-2026-0187',
      imputation: { kind: 'echeance', libelle: 'Loyer novembre 2026', resteDu: 6000 },
      enAttenteDeSolde: true,
    });
    expect(result.pending).toBe(1);
    expect(result.available).toBe(0);
  });

  it('compte en crédit disponible le surplus d’échéance et l’acompte non imputé, pas le dépôt', () => {
    const data = createDemoFinances();
    const bail = 'bl-2023-0007';
    const base = { bailId: bail, date: '2026-11-10', mode: 'virement' as const, reference: '', note: '', comptabilise: true, mentionQuittance: true, recuId: null };
    data.paiements.push(
      { ...base, id: 'p-credit', echeanceId: null, montant: 10000, nature: 'acompte_loyer', libelle: 'Acompte' },
      { ...base, id: 'p-depot', echeanceId: null, montant: 50000, nature: 'acompte_depot', libelle: 'Dépôt' },
      { ...base, id: 'p-hors-compta', echeanceId: null, montant: 7000, nature: 'acompte_loyer', libelle: 'Hors compta', comptabilise: false },
    );
    const echeance = data.echeances.find((entry) => entry.bailId === bail);
    if (!echeance) throw new Error('Échéance de démonstration absente');
    echeance.paye = echeance.montant + 2500;
    const result = leaseAcomptes(data, 'BL-2023-0007');
    expect(result.available).toBe(12500);
    expect(result.entries.map((entry) => entry.imputation.kind).sort()).toEqual(['credit', 'depot', 'non_comptabilise']);
  });

  it('ne renvoie rien pour un bail sans bail financier', () => {
    expect(leaseAcomptes(createDemoFinances(), 'BL-2026-0018')).toEqual({ bailId: null, entries: [], available: 0, pending: 0 });
  });
});

describe('Échéancier : acomptes', () => {
  it('affiche l’acompte, son imputation et le lien vers le reçu', async () => {
    renderLot(<BailEcheancierPage id="studio-2e" />);
    const list = sectionOf(await screen.findByRole('heading', { name: 'Acomptes du bail' }));
    expect(await within(list).findByText(/Acompte sur loyer, 720 €/)).toBeTruthy();
    expect(norm(list.textContent)).toContain('Imputé sur Loyer novembre 2026, reste dû 60 €');
    expect(within(list).getByText('En attente de solde')).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'Reçu RC-2026-0187' }).getAttribute('href')).toBe('/finances/recus/rc-2026-0187');
    expect(within(list).getByRole('link', { name: 'Enregistrer un acompte' }).getAttribute('href')).toBe('/finances/encaissements/acompte?bail=bl-2025-0002');
    expect(norm(screen.getByRole('region', { name: 'Acomptes disponibles' }).textContent)).toContain('0 €Aucun crédit à imputer');
    const documents = sectionOf(await screen.findByRole('heading', { name: 'Documents de l’échéancier' }));
    expect(norm(documents.textContent)).toContain('Reçus d’acompte1 émis, 1 en attente de solde');
  });

  it('indique l’absence d’acompte pour un bail qui n’en a pas', async () => {
    renderLot(<BailEcheancierPage id="apt-a1" />);
    expect(await screen.findByText('Aucun acompte enregistré pour ce bail.')).toBeTruthy();
    expect(norm(screen.getByRole('region', { name: 'Acomptes disponibles' }).textContent)).toContain('Aucun crédit à imputer');
    expect(norm(document.body.textContent)).toContain('Reçus d’acompteAucun reçu d’acompte émis');
  });
});
