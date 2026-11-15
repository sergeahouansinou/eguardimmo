import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { BailDetailPage } from './BailDetailPage';
import { BailEcheancierPage } from './BailEcheancierPage';
import { BailFormPage } from './BailFormPage';
import { BailSortiePage } from './BailSortiePage';
import { BauxPage } from './BauxPage';
import type { Attestation, Lease, LeaseExit } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const leasesOf = async (source: { leases: () => Promise<unknown> }) => (await source.leases()) as Lease[];

describe('BauxPage', () => {
  it('liste les baux actifs avec les compteurs d’onglets', async () => {
    const { container } = renderLot(<BauxPage />);
    const table = await screen.findByRole('table', { name: 'Baux' });
    expect(dataRows(table)).toHaveLength(9);
    expect(screen.getByRole('tab', { name: /À venir/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /Terminés/ }).textContent).toContain('2');
    expect(screen.getByRole('tab', { name: /Brouillons/ }).textContent).toContain('1');
    expect(norm(document.body.textContent)).toContain('9 baux en cours, 8 890 € appelés par mois');
    await expectNoA11yViolations(container);
  });

  it('filtre les baux qui se terminent dans 90 jours', async () => {
    renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: 'Fin dans 90 j' }));
    const rows = dataRows(screen.getByRole('table', { name: 'Baux' }));
    expect(rows).toHaveLength(3);
    expect(norm(rows[0]?.textContent)).toContain('Studio 2e');
    await userEvent.click(screen.getByRole('button', { name: 'Fin dans 30 j' }));
    expect(screen.getByText('Aucun bail ne correspond à ces filtres.')).toBeTruthy();
  });

  it('recherche un bail et trie par loyer décroissant', async () => {
    renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un bail' }), 'koffi');
    expect(dataRows(screen.getByRole('table', { name: 'Baux' }))).toHaveLength(1);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un bail' }));
    await userEvent.click(screen.getByRole('combobox', { name: /^Tri/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Tri : loyer décroissant' }));
    expect(norm(dataRows(screen.getByRole('table', { name: 'Baux' }))[0]?.textContent)).toContain('Villa RDC');
  });

  it('sélectionne des lignes, affiche la barre d’actions et supprime un brouillon après confirmation', async () => {
    const { sources } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner BL-2023-0007' }));
    expect(screen.getByRole('region', { name: 'Actions sur la sélection' }).textContent).toContain('1 sélectionné');
    await userEvent.click(screen.getByRole('button', { name: 'Tout désélectionner' }));
    await userEvent.click(screen.getByRole('tab', { name: /Brouillons/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Plus d’actions, bail BL-2026-0018/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer le brouillon' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => {
      expect((await leasesOf(sources.baux)).some((lease) => lease.id === 'apt-a3-2')).toBe(false);
    });
  });

  it('duplique un bail en brouillon', async () => {
    const { sources } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, bail BL-2023-0007' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dupliquer en brouillon' }));
    await waitFor(async () => {
      const copies = (await leasesOf(sources.baux)).filter((lease) => lease.status === 'brouillon');
      expect(copies).toHaveLength(2);
    });
  });
});

describe('BailFormPage', () => {
  it('bloque l’étape 1 sans bien et affiche l’erreur', async () => {
    renderLot(<BailFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Choisissez le bien loué')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Étape 1, Bien' })).toBeTruthy();
  });

  async function fillUntilConditions(unitName: RegExp, tenantName: string) {
    await userEvent.click(await screen.findByRole('combobox', { name: /Bien loué/ }));
    await userEvent.click(await screen.findByRole('option', { name: unitName }));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: tenantName }));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  }

  it('crée un bail en quatre étapes et rattache le locataire au bien', async () => {
    const { sources, push } = renderLot(<BailFormPage />);
    await fillUntilConditions(/Apt B3/, 'Mariam Sy (invité)');
    await userEvent.type(await screen.findByLabelText('Début du bail *'), '2027-01-01');
    await userEvent.type(screen.getByLabelText('Loyer hors charges (€) *'), '780');
    await userEvent.type(screen.getByLabelText('Charges (€) *'), '70');
    await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), '780');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Étape 4, Récapitulatif' })).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('780 € + 70 € de charges');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le bail' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/apt-b3-2'); });
    const created = (await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-b3-2');
    expect(created).toMatchObject({ rent: 78000, charges: 7000, deposit: 78000, status: 'a_venir', end: '2029-12-31', tenantIds: ['mariam-sy'] });
    const tenants = (await sources.tenants.tenants()) as { id: string; unitId: string | null; status: string }[];
    expect(tenants.find((tenant) => tenant.id === 'mariam-sy')).toMatchObject({ unitId: 'apt-b3', status: 'actif' });
  });

  it('refuse un dépôt supérieur au maximum légal', async () => {
    renderLot(<BailFormPage />);
    await fillUntilConditions(/Apt B3/, 'Mariam Sy (invité)');
    await userEvent.type(await screen.findByLabelText('Début du bail *'), '2027-01-01');
    await userEvent.type(screen.getByLabelText('Loyer hors charges (€) *'), '780');
    await userEvent.type(screen.getByLabelText('Charges (€) *'), '70');
    await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), '1500');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Le dépôt ne peut pas dépasser 1 mois de loyer hors charges')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Étape 3, Conditions' })).toBeTruthy();
  });

  it('refuse un bail qui chevauche un bail en cours', async () => {
    const { sources, push } = renderLot(<BailFormPage />);
    await fillUntilConditions(/Apt A1/, 'Mariam Sy (invité)');
    await userEvent.type(await screen.findByLabelText('Début du bail *'), '2027-01-01');
    await userEvent.type(screen.getByLabelText('Loyer hors charges (€) *'), '780');
    await userEvent.type(screen.getByLabelText('Charges (€) *'), '70');
    await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), '780');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Créer le bail' }));
    expect(await screen.findByText(/déjà loué sur cette période \(bail BL-2023-0007\)/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((await leasesOf(sources.baux)).filter((lease) => lease.unitId === 'apt-a1')).toHaveLength(2);
  });

  it('enregistre un brouillon avec le seul bien', async () => {
    const { sources, push } = renderLot(<BailFormPage />);
    await userEvent.click(await screen.findByRole('combobox', { name: /Bien loué/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Villa RDC/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/villa-rdc-2'); });
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'villa-rdc-2')?.status).toBe('brouillon');
  });

  it('préremplit le bien et le locataire depuis l’adresse', async () => {
    renderLot(<BailFormPage />, { search: 'bien=apt-b3&locataire=mariam-sy' });
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('checkbox', { name: 'Mariam Sy (invité)' })).toHaveProperty('checked', true);
  });

  it('modifie le loyer d’un bail existant', async () => {
    const { sources, push } = renderLot(<BailFormPage id="apt-a1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    const rent = await screen.findByLabelText('Loyer hors charges (€) *');
    await userEvent.clear(rent);
    await userEvent.type(rent, '790,50');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le bail' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/apt-a1'); });
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a1')?.rent).toBe(79050);
  });
});

describe('BailDetailPage', () => {
  it('affiche le résumé, l’impayé et les onglets du bail de Koffi Adjovi', async () => {
    const { container } = renderLot(<BailDetailPage id="apt-a1" />);
    expect(await screen.findByRole('heading', { name: /Bail BL-2023-0007/ })).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('850 € d’impayé sur ce bail.');
    expect(await screen.findByText('Relancer l’impayé de novembre')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Documents/ }));
    expect(await screen.findByText('Bail signé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /États des lieux/ }));
    expect(await screen.findByText(/EDL-2023-002/)).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Historique/ }));
    expect(await screen.findByText('Relance envoyée par e-mail')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('signale un bail introuvable avec un retour', async () => {
    renderLot(<BailDetailPage id="inconnu" />);
    expect(await screen.findByText('Ce bail n’existe pas')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux baux' }).getAttribute('href')).toBe('/baux');
  });
});

describe('BailEcheancierPage', () => {
  it('liste les échéances avec l’impayé de novembre et l’avis de décembre', async () => {
    const { container } = renderLot(<BailEcheancierPage id="apt-a1" />);
    const table = await screen.findByRole('table', { name: 'Échéances du bail' });
    const rows = dataRows(table);
    expect(norm(rows[0]?.textContent)).toContain('Décembre 2026');
    expect(norm(rows[0]?.textContent)).toContain('1 700 €');
    expect(norm(rows[0]?.textContent)).toContain('À émettre');
    expect(norm(rows[1]?.textContent)).toContain('Novembre 2026');
    expect(norm(rows[1]?.textContent)).toContain('Impayé');
    expect(within(at(rows, 1)).getByRole('link', { name: 'Relancer' })).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'Avis d’échéance' }).getAttribute('href')).toBe('/documents/avis-echeance/av-20261201-apt-a1');
    await expectNoA11yViolations(container);
  });

  it('filtre par année', async () => {
    renderLot(<BailEcheancierPage id="apt-a1" />);
    await screen.findByRole('table', { name: 'Échéances du bail' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Année/ }));
    await userEvent.click(await screen.findByRole('option', { name: '2023' }));
    const rows = dataRows(screen.getByRole('table', { name: 'Échéances du bail' }));
    expect(rows).toHaveLength(9);
  });

  it('indique l’absence d’échéance pour un brouillon', async () => {
    renderLot(<BailEcheancierPage id="apt-a3-2" />);
    expect(await screen.findByText('Aucune échéance')).toBeTruthy();
  });
});

describe('BailSortiePage', () => {
  it('refuse la restitution tant que l’état des lieux et le décompte ne sont pas faits', async () => {
    const { sources } = renderLot(<BailSortiePage id="studio-b3" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer comme restitué' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme restitué' }));
    expect(await screen.findByText('Terminez l’état des lieux de sortie et le décompte du dépôt avant la restitution.')).toBeTruthy();
    expect((await sources.baux.attestations() as Attestation[]).some((entry) => entry.leaseId === 'studio-b3')).toBe(false);
  });

  it('restitue le dépôt, génère l’attestation et clôture le bail', async () => {
    const { sources, push } = renderLot(<BailSortiePage id="studio-b3" />);
    await screen.findByText('Décompte du dépôt', { selector: 'h2' });
    expect(norm(document.body.textContent)).toContain('878 €');
    const edl = screen.getByText('État des lieux de sortie').closest('li') as HTMLElement;
    await userEvent.click(within(edl).getByRole('button', { name: 'Marquer comme fait' }));
    await waitFor(() => { expect(within(edl).queryByRole('button', { name: 'Marquer comme fait' })).toBeNull(); });
    const decompte = screen.getAllByText('Décompte du dépôt').map((node) => node.closest('li')).find(Boolean) as HTMLElement;
    await userEvent.click(within(decompte).getByRole('button', { name: 'Marquer comme fait' }));
    await waitFor(() => { expect(within(decompte).queryByRole('button', { name: 'Marquer comme fait' })).toBeNull(); });
    await userEvent.click(screen.getByRole('button', { name: 'Marquer comme restitué' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme restitué' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/documents/attestations/at-2026-0001'); });
    const attestations = (await sources.baux.attestations()) as Attestation[];
    expect(attestations.find((entry) => entry.id === 'at-2026-0001')).toMatchObject({ returned: 87800, tenantName: 'Yann Le Gall', leaseReference: 'BL-2024-0013' });
    expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'studio-b3')?.status).toBe('termine');
    const exits = (await sources.baux.exits()) as LeaseExit[];
    expect(exits.find((entry) => entry.leaseId === 'studio-b3')?.depositReturned).toBe(true);
  });

  it('enregistre un préavis sur un bail sans préavis et le passe en préavis donné', async () => {
    const { sources } = renderLot(<BailSortiePage id="apt-a2" />);
    await userEvent.click(at(await screen.findAllByRole('button', { name: 'Enregistrer un préavis' }), 0));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le préavis' }));
    await waitFor(async () => {
      expect((await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-a2')?.status).toBe('preavis');
    });
    expect(await screen.findByText('Préavis reçu')).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('13/02/2027');
  });

  it('valide que le départ ne précède pas la réception du préavis', async () => {
    const { sources } = renderLot(<BailSortiePage id="apt-a2" />);
    await userEvent.click(at(await screen.findAllByRole('button', { name: 'Enregistrer un préavis' }), 0));
    const dialog = await screen.findByRole('dialog');
    const departure = within(dialog).getByLabelText('Départ le *');
    await userEvent.clear(departure);
    await userEvent.type(departure, '2026-10-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le préavis' }));
    expect(await screen.findByText('La date de départ ne peut pas précéder la réception du préavis.')).toBeTruthy();
    expect((await sources.baux.exits() as LeaseExit[]).some((entry) => entry.leaseId === 'apt-a2')).toBe(false);
  });
});
