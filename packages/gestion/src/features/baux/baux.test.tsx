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
    expect(norm(document.body.textContent)).toContain('9 baux en cours, 8 890 € appelés par mois, charges comprises. 1 se termine dans moins de 60 jours.');
    await expectNoA11yViolations(container);
  });

  it('présente type, charges, dépôt, fin et solde de chaque bail', async () => {
    renderLot(<BauxPage />);
    const table = await screen.findByRole('table', { name: 'Baux' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Tout sélectionner', 'Bien', 'Locataire', 'Type', 'Loyer', 'Charges', 'Dépôt', 'Fin', 'Solde', 'État', 'Actions']);
    const first = norm(at(dataRows(table), 0).textContent);
    expect(first).toContain('Studio 2e');
    expect(first).toContain('Meublé');
    expect(first).toContain('31/12/2026');
    expect(first).toContain('-60 €');
    expect(first).toContain('Préavis donné');
    const apt = norm(at(dataRows(table).filter((row) => row.textContent.includes('BL-2023-0007')), 0).textContent);
    expect(apt).toContain('Vide');
    expect(apt).toContain('-850 €');
  });

  it('annonce le préavis le plus proche dans un bandeau avec lien vers la sortie', async () => {
    renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    const banner = screen.getByRole('status', { name: '' });
    expect(norm(banner.textContent)).toContain('Bail de Ibrahim Yao, fin le 31/12/2026');
    expect(norm(banner.textContent)).toContain('Préavis donné. Vérifier l’état des lieux de sortie.');
    expect(norm(banner.textContent)).toContain('1 autre préavis en cours.');
    expect(within(banner).getByRole('link', { name: 'Ouvrir' }).getAttribute('href')).toBe('/baux/studio-2e/sortie');
  });

  it('filtre par immeuble, type de location et solde', async () => {
    renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Solde/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Impayés' }));
    expect(dataRows(screen.getByRole('table', { name: 'Baux' }))).toHaveLength(3);
    await userEvent.click(screen.getByRole('combobox', { name: /^Type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Meublé' }));
    const rows = dataRows(screen.getByRole('table', { name: 'Baux' }));
    expect(rows).toHaveLength(1);
    expect(norm(at(rows, 0).textContent)).toContain('Studio 2e');
    await userEvent.click(screen.getByRole('combobox', { name: /^Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Les Tilleuls' }));
    expect(screen.getByText('Aucun bail ne correspond à ces filtres.')).toBeTruthy();
  });

  it('envoie un avis pour la sélection de baux en cours', async () => {
    const { push } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner BL-2023-0007' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner BL-2024-0003' }));
    expect(screen.getByRole('region', { name: 'Actions sur la sélection' }).textContent).toContain('2 baux sélectionnés');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer un avis' }));
    expect(push).toHaveBeenLastCalledWith('/documents/avis-echeance');
  });

  it('renouvelle un bail en préremplissant le bien, le locataire et le début', async () => {
    const { push } = renderLot(<BauxPage />);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, bail BL-2023-0007' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Renouveler' }));
    expect(push).toHaveBeenLastCalledWith('/baux/nouveau?bien=apt-a1&locataire=koffi-adjovi&debut=2029-04-01');
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
    expect(screen.getByRole('region', { name: 'Actions sur la sélection' }).textContent).toContain('1 bail sélectionné');
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
    await userEvent.type(await screen.findByLabelText('Début du bail *'), '2027-12-01');
    await userEvent.type(screen.getByLabelText('Loyer hors charges (€) *'), '780');
    await userEvent.type(screen.getByLabelText('Charges (€) *'), '70');
    await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), '780');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Étape 4, Récapitulatif' })).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('780 € + 70 € de charges');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le bail' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/apt-b3-2'); });
    const created = (await leasesOf(sources.baux)).find((lease) => lease.id === 'apt-b3-2');
    expect(created).toMatchObject({ rent: 78000, charges: 7000, deposit: 78000, status: 'a_venir', end: '2030-11-30', tenantIds: ['mariam-sy'] });
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

  it('refuse un bail qui chevauche un bail à venir', async () => {
    const { sources, push } = renderLot(<BailFormPage />);
    await fillUntilConditions(/Apt B3/, 'Mariam Sy (invité)');
    await userEvent.type(await screen.findByLabelText('Début du bail *'), '2026-12-01');
    await userEvent.type(screen.getByLabelText('Loyer hors charges (€) *'), '780');
    await userEvent.type(screen.getByLabelText('Charges (€) *'), '70');
    await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), '780');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Créer le bail' }));
    expect(await screen.findByText(/déjà loué sur cette période \(bail BL-2026-0017\)/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((await leasesOf(sources.baux)).filter((lease) => lease.unitId === 'apt-b3')).toHaveLength(1);
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

  it('affiche le récapitulatif vivant et filtre les locataires avec le compteur de sélection', async () => {
    renderLot(<BailFormPage />, { search: 'bien=apt-b3&debut=2027-04-01' });
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    const recap = screen.getByRole('group', { name: 'Récapitulatif' });
    expect(norm(recap.textContent)).toContain('Début01/04/2027');
    expect(norm(recap.textContent)).toContain('Les conditions se règlent à l’étape suivante.');
    expect(norm(document.body.textContent)).toContain('0 sélectionné. Recherchez un locataire existant ou invitez-en un nouveau.');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un locataire' }), 'mariam');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mariam Sy (invité)' }));
    expect(norm(document.body.textContent)).toContain('1 sélectionné.');
    expect(norm(recap.textContent)).toContain('LocataireMariam Sy');
  });

  it('ignore une date de début invalide dans l’adresse', async () => {
    renderLot(<BailFormPage />, { search: 'bien=apt-b3&debut=demain' });
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(norm(screen.getByRole('group', { name: 'Récapitulatif' }).textContent)).toContain('Début—');
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

  it('complète le résumé : impayés, avis, révision, parties, dernières échéances et aperçus', async () => {
    renderLot(<BailDetailPage id="apt-a1" />);
    expect(await screen.findByText('1 échéance impayée')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Émettre l’avis d’échéance' }).getAttribute('href')).toBe('/documents/avis-echeance/av-20261201-apt-a1');
    expect(norm(document.body.textContent)).toContain('Prochaine révision01/04/2027');
    const parties = await screen.findByRole('region', { name: 'Parties au bail' });
    expect(within(parties).getByRole('link', { name: 'Fiche locataire' })).toBeTruthy();
    expect(within(parties).getByRole('link', { name: 'Fiche du bien' }).getAttribute('href')).toBe('/biens/apt-a1');
    const latest = await screen.findByRole('table', { name: 'Dernières échéances' });
    const rows = dataRows(latest);
    expect(rows).toHaveLength(3);
    expect(norm(at(rows, 0).textContent)).toContain('01/11/2026850 €0 €850 €Impayé');
    expect(norm(document.body.textContent)).toContain('43 payées');
    expect(screen.getByRole('link', { name: 'Tout voir, 44' }).getAttribute('href')).toBe('/baux/apt-a1/echeancier');
    await userEvent.click(within(screen.getByRole('region', { name: 'Documents du bail' })).getByRole('button', { name: 'Tout voir, 3' }));
    expect(await screen.findByText('Bail signé')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Documents/ }).getAttribute('aria-selected')).toBe('true');
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

  it('affiche arriéré cumulé, quittances, règle, dettes antérieures et dépôt', async () => {
    renderLot(<BailEcheancierPage id="apt-a1" />);
    const table = await screen.findByRole('table', { name: 'Échéances du bail' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Mois', 'Échéance', 'Appelé', 'Reçu', 'Reste dû', 'Arriéré cumulé', 'Statut', 'Quittance', 'Actions']);
    const rows = dataRows(table);
    expect(norm(at(rows, 0).textContent)).toContain('1 700 €1 700 €');
    expect(norm(at(rows, 0).textContent)).toContain('Après solde');
    expect(norm(at(rows, 1).textContent)).toContain('850 €850 €');
    expect(norm(at(rows, 1).textContent)).toContain('Non émise');
    expect(within(at(rows, 2)).getByRole('link', { name: 'QT-2026-0398' }).getAttribute('href')).toBe('/documents/quittances/qt-2026-0398');
    expect(norm(document.body.textContent)).toContain('Une quittance n’est émise que lorsque l’échéance est soldée, dettes antérieures comprises.');
    expect(norm(document.body.textContent)).toContain('Dettes antérieures850 €Reportées sur l’avis de décembre 2026');
    expect(norm(document.body.textContent)).toContain('Dépôt de garantie770 €Détenu, restitué à la sortie');
    expect(await screen.findByText('Dettes les plus anciennes')).toBeTruthy();
    expect(norm(document.body.textContent)).toContain('Quittances émises43 sur 44, la dernière en octobre 2026');
  });

  it('filtre les échéances impayées puis soldées et pagine la liste', async () => {
    renderLot(<BailEcheancierPage id="apt-a1" />);
    await screen.findByRole('table', { name: 'Échéances du bail' });
    expect(screen.getByRole('tab', { name: /Toutes/ }).textContent).toContain('45');
    expect(dataRows(screen.getByRole('table', { name: 'Échéances du bail' }))).toHaveLength(12);
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(norm(document.body.textContent)).toContain('13 à 24 sur 45');
    await userEvent.click(screen.getByRole('tab', { name: /Impayées/ }));
    const unpaid = dataRows(screen.getByRole('table', { name: 'Échéances du bail' }));
    expect(unpaid).toHaveLength(1);
    expect(norm(at(unpaid, 0).textContent)).toContain('Novembre 2026');
    await userEvent.click(screen.getByRole('tab', { name: /Soldées/ }));
    expect(screen.getByRole('tab', { name: /Soldées/ }).textContent).toContain('43');
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
    expect((await screen.findAllByText('Préavis reçu')).length).toBeGreaterThan(1);
    expect(norm(document.body.textContent)).toContain('13/02/2027');
  });

  it('produit tous les blocs du déroulé après l’enregistrement du préavis', async () => {
    renderLot(<BailSortiePage id="apt-a2" />);
    await userEvent.click(at(await screen.findAllByRole('button', { name: 'Enregistrer un préavis' }), 0));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Enregistrer le préavis' }));
    await screen.findByText('Étapes de la sortie');
    const text = norm(document.body.textContent);
    for (const label of ['Restitution et attestation', 'Clôture du bail', 'Retenues estimées', 'À restituer', 'Durée applicable', 'Dernière échéance', 'Départ prévu', 'Régularisation des charges 2027', 'Réparations imputables', 'Planifier la visite', 'Accusé de réception']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('Retenues estimées0 €');
    expect(text).toContain('Départ le 13/02/2027');
  });

  it('résume la sortie de Yann Le Gall avec retenues, départ et accès aux actions', async () => {
    renderLot(<BailSortiePage id="studio-b3" />);
    await screen.findByText('Étapes de la sortie');
    const text = norm(document.body.textContent);
    expect(text).toContain('Retenues estimées122 €Réparations imputables');
    expect(text).toContain('À restituer878 €Estimation avant l’état des lieux');
    expect(text).toContain('Départ le 31/01/2027');
    expect(text).toContain('Durée applicable1 mois, meublé');
    expect(text).toContain('Dégradation');
    expect(screen.getByRole('link', { name: 'Planifier la visite' }).getAttribute('href')).toBe('/baux/etats-des-lieux/nouveau?bien=studio-b3');
    expect(screen.getByRole('link', { name: 'Accusé de réception' }).getAttribute('href')).toContain('modele=accuse-de-reception-du-preavis');
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
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
