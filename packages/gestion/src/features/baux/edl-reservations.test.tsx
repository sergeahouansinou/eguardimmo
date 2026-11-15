import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { EtatLieuxFormPage } from './EtatLieuxFormPage';
import { EtatLieuxPage } from './EtatLieuxPage';
import { EtatsLieuxPage } from './EtatsLieuxPage';
import { ReservationsPage } from './ReservationsPage';
import type { Edl, Reservation } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const dataRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const edlsOf = async (source: { edls: () => Promise<unknown> }) => (await source.edls()) as Edl[];
const reservationsOf = async (source: { reservations: () => Promise<unknown> }) => (await source.reservations()) as Reservation[];

describe('EtatsLieuxPage', () => {
  it('liste les états des lieux à traiter avec les compteurs', async () => {
    const { container } = renderLot(<EtatsLieuxPage />);
    const table = await screen.findByRole('table', { name: 'États des lieux' });
    expect(dataRows(table)).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Signés/ }).textContent).toContain('3');
    expect(screen.getByRole('tab', { name: /Archivés/ }).textContent).toContain('1');
    await expectNoA11yViolations(container);
  });

  it('filtre par type et par recherche', async () => {
    renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('combobox', { name: /^Type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Sortie' }));
    expect(dataRows(screen.getByRole('table', { name: 'États des lieux' }))).toHaveLength(2);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un état des lieux' }), 'zzz');
    expect(screen.getByText('Aucun état des lieux ne correspond à ces filtres.')).toBeTruthy();
  });

  it('signe un état des lieux planifié', async () => {
    const { sources } = renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-006' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Marquer comme signé' }));
    await waitFor(async () => {
      expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-006')?.status).toBe('signe');
    });
  });

  it('refuse de signer un état des lieux sans date', async () => {
    const { sources } = renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-005' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Marquer comme signé' }));
    expect(await screen.findByText('Planifiez une date avant de signer l’état des lieux.')).toBeTruthy();
    expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-005')?.status).toBe('a_planifier');
  });

  it('archive puis supprime un brouillon après confirmation', async () => {
    const { sources } = renderLot(<EtatsLieuxPage />);
    await screen.findByRole('table', { name: 'États des lieux' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, EDL-2026-007' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await waitFor(async () => {
      expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-007')?.archived).toBe(true);
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, EDL-2026-006' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer le brouillon' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => {
      expect((await edlsOf(sources.baux)).some((edl) => edl.id === 'edl-2026-006')).toBe(false);
    });
  });
});

describe('EtatLieuxFormPage', () => {
  it('exige le bien avant de créer', async () => {
    const { push } = renderLot(<EtatLieuxFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Créer et commencer le relevé' }));
    expect(await screen.findByText('Choisissez le bien')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('crée un état des lieux planifié et reprend le locataire du bail en cours', async () => {
    const { sources, push } = renderLot(<EtatLieuxFormPage />, { search: 'bien=apt-a1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer et commencer le relevé' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-008'); });
    const created = (await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-008');
    expect(created).toMatchObject({ status: 'prevu', unitId: 'apt-a1', date: '2026-11-13', rooms: ['Entrée', 'Séjour'] });
  });

  it('enregistre un brouillon', async () => {
    const { sources, push } = renderLot(<EtatLieuxFormPage />, { search: 'bien=villa-rdc' });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer en brouillon' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-008'); });
    expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-008')?.status).toBe('brouillon');
  });

  it('exige au moins une pièce', async () => {
    renderLot(<EtatLieuxFormPage />, { search: 'bien=apt-a1' });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Entrée' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Séjour' }));
    await userEvent.click(screen.getByRole('button', { name: 'Créer et commencer le relevé' }));
    expect(await screen.findByText('Contrôlez au moins une pièce')).toBeTruthy();
  });

  it('modifie la date d’un état des lieux existant', async () => {
    const { sources, push } = renderLot(<EtatLieuxFormPage id="edl-2026-006" />);
    const date = await screen.findByLabelText('Date *');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-12-02');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/etats-des-lieux/edl-2026-006'); });
    expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-006')?.date).toBe('2026-12-02');
  });
});

describe('EtatLieuxPage', () => {
  it('affiche le détail et permet de le signer', async () => {
    const { container, sources } = renderLot(<EtatLieuxPage id="edl-2026-006" />);
    expect(await screen.findByRole('heading', { name: /EDL-2026-006/ })).toBeTruthy();
    expect(await screen.findByText('Maison, avec jardin')).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Marquer comme signé' }));
    await waitFor(async () => {
      expect((await edlsOf(sources.baux)).find((edl) => edl.id === 'edl-2026-006')?.status).toBe('signe');
    });
    expect(await screen.findByText('État des lieux signé par les deux parties.')).toBeTruthy();
  });

  it('signale un état des lieux introuvable', async () => {
    renderLot(<EtatLieuxPage id="inconnu" />);
    expect(await screen.findByText('Cet état des lieux n’existe pas')).toBeTruthy();
  });
});

describe('ReservationsPage', () => {
  it('liste les réservations actives et filtre les options', async () => {
    const { container } = renderLot(<ReservationsPage />);
    const table = await screen.findByRole('table', { name: 'Réservations' });
    expect(dataRows(table)).toHaveLength(7);
    await userEvent.click(screen.getByRole('tab', { name: /Options/ }));
    const rows = dataRows(screen.getByRole('table', { name: 'Réservations' }));
    expect(rows).toHaveLength(1);
    expect(norm(at(rows, 0).textContent)).toContain('Julien Morel');
    expect(norm(at(rows, 0).textContent)).toContain('Jusqu’au 16/11/2026');
    await expectNoA11yViolations(container);
  });

  it('confirme une option', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Options/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions, RS-2026-033' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Confirmer l’option' }));
    await waitFor(async () => {
      expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-033')?.status).toBe('confirmee');
    });
  });

  it('annule une réservation après confirmation', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await screen.findByRole('table', { name: 'Réservations' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, RS-2026-031' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler la réservation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la réservation' }));
    await waitFor(async () => {
      expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-031')?.status).toBe('annulee');
    });
  });

  it('duplique une réservation en option', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await screen.findByRole('table', { name: 'Réservations' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, RS-2026-029' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Dupliquer en option' }));
    await waitFor(async () => {
      expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-034')).toMatchObject({ status: 'option', paid: 0, optionUntil: '2026-11-20' });
    });
  });

  it('ouvre le dialogue d’import avec le modèle CSV', async () => {
    renderLot(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Télécharger le modèle' })).toBeTruthy();
    expect(norm(dialog.textContent)).toContain('Bien, Voyageur, Arrivée, Départ, Montant, Acompte');
  });
});
