import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { FROZEN_NOW, at, norm, renderLot } from '../../../test/lots';
import { ReservationContratPage } from './ReservationContratPage';
import { ReservationFormPage } from './ReservationFormPage';
import { ReservationsPage } from './ReservationsPage';
import { parseReservationsCsv } from './reservationsImport';
import type { Reservation } from './schemas';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const reservationsOf = async (source: { reservations: () => Promise<unknown> }) => (await source.reservations()) as Reservation[];

async function chooseUnit(label: RegExp) {
  await userEvent.click(await screen.findByRole('combobox', { name: /^Bien/ }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

async function fillStay(values: { guest?: string; arrival: string; departure: string; amount: string; paid?: string; deposit?: string }) {
  if (values.guest) await userEvent.type(screen.getByLabelText('Voyageur *'), values.guest);
  fireEvent.change(screen.getByLabelText('Arrivée *'), { target: { value: values.arrival } });
  fireEvent.change(screen.getByLabelText('Départ *'), { target: { value: values.departure } });
  await userEvent.type(screen.getByLabelText('Montant du séjour (€) *'), values.amount);
  if (values.paid) {
    await userEvent.clear(screen.getByLabelText('Acompte reçu (€) *'));
    await userEvent.type(screen.getByLabelText('Acompte reçu (€) *'), values.paid);
  }
  await userEvent.type(screen.getByLabelText('Dépôt de garantie (€) *'), values.deposit ?? '0');
}

describe('ReservationFormPage, création', () => {
  it('crée une réservation confirmée avec solde calculé', async () => {
    const { sources, push, container } = renderLot(<ReservationFormPage />);
    await chooseUnit(/Gîte du Lac/);
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('radio', { name: 'Confirmée' }));
    await fillStay({ guest: 'Anna Kowalski', arrival: '2026-12-10', departure: '2026-12-14', amount: '500', paid: '150', deposit: '300' });
    expect(screen.getByText(/Solde à percevoir : 350/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Créer la réservation' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/reservations'); });
    const created = (await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-034');
    expect(created).toMatchObject({ unitId: 'gite-du-lac', guest: 'Anna Kowalski', arrival: '2026-12-10', departure: '2026-12-14', amount: 50000, paid: 15000, deposit: 30000, status: 'acompte_recu' });
  });

  it('crée une option avec échéance et la préremplit depuis le bien de l’URL', async () => {
    const { sources } = renderLot(<ReservationFormPage />, { search: 'bien=studio-plage' });
    await screen.findByLabelText('Voyageur *');
    expect(screen.getByRole('combobox', { name: /^Bien/ }).textContent).toContain('Studio Plage');
    await fillStay({ guest: 'Léa Martin', arrival: '2026-12-20', departure: '2026-12-23', amount: '210' });
    await userEvent.click(screen.getByRole('button', { name: 'Créer la réservation' }));
    await waitFor(async () => { expect((await reservationsOf(sources.baux)).some((item) => item.guest === 'Léa Martin')).toBe(true); });
    const created = (await reservationsOf(sources.baux)).find((item) => item.guest === 'Léa Martin');
    expect(created).toMatchObject({ status: 'option', optionUntil: '2026-11-20', paid: 0 });
  });

  it('valide les champs obligatoires et n’enregistre rien', async () => {
    const { sources, push } = renderLot(<ReservationFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Créer la réservation' }));
    expect(await screen.findByText('Choisissez le bien')).toBeTruthy();
    expect(screen.getByText('Renseignez le voyageur')).toBeTruthy();
    expect(screen.getByText('Renseignez la date d’arrivée')).toBeTruthy();
    expect(screen.getByText('Indiquez le montant du séjour, ex. 630 ou 630,50')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(await reservationsOf(sources.baux)).toHaveLength(8);
  });

  it('refuse un départ avant l’arrivée et un acompte supérieur au montant', async () => {
    renderLot(<ReservationFormPage />, { search: 'bien=studio-plage' });
    await screen.findByLabelText('Voyageur *');
    await fillStay({ guest: 'Test', arrival: '2026-12-20', departure: '2026-12-19', amount: '100', paid: '150' });
    await userEvent.click(screen.getByRole('button', { name: 'Créer la réservation' }));
    expect(await screen.findByText('Le départ doit suivre l’arrivée')).toBeTruthy();
    expect(screen.getByText('L’acompte ne peut pas dépasser le montant du séjour')).toBeTruthy();
  });

  it('signale le chevauchement et refuse l’enregistrement', async () => {
    const { sources, push } = renderLot(<ReservationFormPage />, { search: 'bien=studio-plage' });
    await screen.findByLabelText('Voyageur *');
    await fillStay({ guest: 'Doublon', arrival: '2026-11-20', departure: '2026-11-22', amount: '100' });
    expect(await screen.findByText(/Ce bien est déjà réservé du 18\/11\/2026 au 25\/11\/2026 \(RS-2026-031\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Créer la réservation' }));
    expect(await screen.findByText('Ce bien est déjà réservé sur ces dates (RS-2026-031).')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((await reservationsOf(sources.baux)).some((item) => item.guest === 'Doublon')).toBe(false);
  });

  it('autorise une arrivée le jour du départ d’un autre voyageur', async () => {
    const { sources } = renderLot(<ReservationFormPage />, { search: 'bien=studio-plage' });
    await screen.findByLabelText('Voyageur *');
    await fillStay({ guest: 'Relais', arrival: '2026-11-25', departure: '2026-11-28', amount: '100' });
    await userEvent.click(screen.getByRole('button', { name: 'Créer la réservation' }));
    await waitFor(async () => { expect((await reservationsOf(sources.baux)).some((item) => item.guest === 'Relais')).toBe(true); });
  });
});

describe('ReservationFormPage, modification', () => {
  it('modifie le voyageur et le montant d’une réservation existante', async () => {
    const { sources, push } = renderLot(<ReservationFormPage id="rs-2026-031" />);
    const guest = await screen.findByLabelText('Voyageur *');
    expect((guest as HTMLInputElement).value).toBe('Anna Kowalski');
    await userEvent.clear(guest);
    await userEvent.type(guest, 'Anna Nowak');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/baux/reservations'); });
    expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-031')).toMatchObject({ guest: 'Anna Nowak', amount: 63000, paid: 18900 });
  });

  it('refuse un déplacement sur une période déjà prise', async () => {
    const { sources } = renderLot(<ReservationFormPage id="rs-2026-029" />);
    await screen.findByLabelText('Voyageur *');
    fireEvent.change(screen.getByLabelText('Départ *'), { target: { value: '2026-11-19' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Ce bien est déjà réservé sur ces dates (RS-2026-031).')).toBeTruthy();
    expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-029')?.departure).toBe('2026-11-16');
  });

  it('refuse de modifier une réservation annulée et signale un identifiant inconnu', async () => {
    const first = renderLot(<ReservationFormPage id="rs-2026-025" />);
    expect(await screen.findByText('Une réservation annulée ne se modifie pas')).toBeTruthy();
    first.unmount();
    renderLot(<ReservationFormPage id="rs-inconnu" />);
    expect(await screen.findByText('Cette réservation n’existe pas')).toBeTruthy();
  });
});

describe('Import CSV', () => {
  const units = [{ id: 'studio-plage', label: 'Studio Plage', building: 'Résidence de la Plage' }, { id: 'gite-du-lac', label: 'Gîte du Lac', building: 'Domaine du Lac' }];
  const existing: Pick<Reservation, 'unitId' | 'arrival' | 'departure' | 'status'>[] = [{ unitId: 'studio-plage', arrival: '2026-11-18', departure: '2026-11-25', status: 'confirmee' }];
  const header = 'Bien;Voyageur;Arrivée;Départ;Montant;Acompte;Dépôt';

  it('valide ligne par ligne et rapporte les lignes rejetées avec leur motif', () => {
    const csv = [
      header,
      'Gîte du Lac;Famille Dupont;10/01/2027;15/01/2027;800;200;600',
      'Villa inconnue;Paul;01/02/2027;05/02/2027;300;0;0',
      'Studio Plage;Sans montant;01/02/2027;05/02/2027;;0;0',
      'Studio Plage;Chevauche;20/11/2026;22/11/2026;100;0;0',
      'Studio Plage;Inversé;05/03/2027;01/03/2027;100;0;0',
      'Studio Plage;Trop court;01/03/2027',
    ].join('\n');
    const report = parseReservationsCsv(csv, units, existing, '2026-11-13');
    expect(report.accepted).toHaveLength(1);
    expect(report.accepted[0]).toMatchObject({ line: 2, input: { unitId: 'gite-du-lac', arrival: '2027-01-10', departure: '2027-01-15', mode: 'confirmee' } });
    expect(report.rejected.map((entry) => entry.line)).toEqual([3, 4, 5, 6, 7]);
    expect(report.rejected[0]?.reason).toBe('Bien inconnu : « Villa inconnue ».');
    expect(report.rejected[1]?.reason).toBe('Indiquez le montant du séjour, ex. 630 ou 630,50');
    expect(report.rejected[2]?.reason).toContain('déjà réservé du 18/11/2026 au 25/11/2026');
    expect(report.rejected[3]?.reason).toBe('Le départ doit suivre l’arrivée');
    expect(report.rejected[4]?.reason).toBe('3 colonnes trouvées, 6 ou 7 attendues.');
  });

  it('détecte les chevauchements entre lignes du même fichier', () => {
    const csv = [header, 'Studio Plage;Un;01/03/2027;05/03/2027;100;0;0', 'Studio Plage;Deux;03/03/2027;08/03/2027;100;0;0'].join('\n');
    const report = parseReservationsCsv(csv, units, [], '2026-11-13');
    expect(report.accepted).toHaveLength(1);
    expect(report.rejected).toEqual([{ line: 3, reason: expect.stringContaining('Studio Plage est déjà réservé') as string }]);
  });

  it('rejette un en-tête invalide, un fichier vide et un fichier trop long', () => {
    expect(parseReservationsCsv('', units, [], '2026-11-13').rejected[0]?.reason).toBe('Le fichier est vide.');
    expect(parseReservationsCsv('Nom;Prénom\nA;B', units, [], '2026-11-13').rejected[0]?.reason).toContain('En-tête invalide');
    const rows = Array.from({ length: 201 }, (_, index) => `Studio Plage;V${String(index)};01/03/2027;02/03/2027;10;0;0`);
    expect(parseReservationsCsv([header, ...rows].join('\n'), units, [], '2026-11-13').rejected[0]?.reason).toBe('Le fichier dépasse 200 réservations.');
  });

  it('accepte un acompte comme confirmée et ignore le BOM', () => {
    const report = parseReservationsCsv(`﻿${header}\nStudio Plage;Payé;01/03/2027;04/03/2027;300;300;100`, units, [], '2026-11-13');
    expect(report.accepted[0]?.input).toMatchObject({ mode: 'confirmee', paid: '300', deposit: '100' });
  });

  it('importe un fichier depuis le dialogue et affiche le rapport des rejets', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    const csv = [header, 'Gîte du Lac;Famille Dupont;10/02/2027;15/02/2027;800;200;600', 'Villa inconnue;Paul;01/02/2027;05/02/2027;300;0;0'].join('\n');
    await userEvent.upload(within(dialog).getByLabelText('Fichier CSV des réservations'), new File([csv], 'reservations.csv', { type: 'text/csv' }), { applyAccept: false });
    expect(await within(dialog).findByText('1 ligne valide, 1 rejetée')).toBeTruthy();
    const rejected = within(dialog).getByRole('table', { name: 'Lignes rejetées' });
    expect(norm(rejected.textContent)).toContain('Bien inconnu : « Villa inconnue ».');
    await userEvent.click(within(dialog).getByRole('button', { name: /Importer 1 réservation/ }));
    await waitFor(async () => { expect((await reservationsOf(sources.baux)).some((item) => item.guest === 'Famille Dupont')).toBe(true); });
  });

  it('refuse un fichier qui n’est pas un CSV', async () => {
    renderLot(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('Fichier CSV des réservations'), new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false });
    expect(await within(dialog).findByText('Choisissez un fichier .csv.')).toBeTruthy();
  });
});

describe('Actions du menu des réservations', () => {
  const open = async (reference: string, item: string) => {
    await screen.findByRole('table', { name: 'Réservations' });
    await userEvent.click(screen.getByRole('button', { name: `Plus d’actions, ${reference}` }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
  };

  it('ouvre Modifier, le contrat et l’encaissement de la réservation', async () => {
    const { push } = renderLot(<ReservationsPage />);
    await open('RS-2026-031', 'Modifier');
    expect(push).toHaveBeenLastCalledWith('/baux/reservations/rs-2026-031/modifier');
    await open('RS-2026-031', 'Contrat de location');
    expect(push).toHaveBeenLastCalledWith('/baux/reservations/rs-2026-031/contrat');
    await open('RS-2026-031', 'Enregistrer un paiement');
    expect(push).toHaveBeenLastCalledWith('/finances/encaissements/nouveau?reservation=rs-2026-031');
  });

  it('envoie la confirmation et relance le solde, avec la date enregistrée', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await open('RS-2026-031', 'Envoyer la confirmation');
    await waitFor(async () => { expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-031')?.confirmationSentOn).toBe('2026-11-13'); });
    await open('RS-2026-031', 'Relancer le solde');
    await waitFor(async () => { expect((await reservationsOf(sources.baux)).find((item) => item.id === 'rs-2026-031')?.reminderSentOn).toBe('2026-11-13'); });
  });

  it('bloque la confirmation d’une option et la relance d’une réservation soldée', async () => {
    renderLot(<ReservationsPage />);
    await screen.findByRole('table', { name: 'Réservations' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, RS-2026-029' }));
    expect((await screen.findByRole('menuitem', { name: 'Relancer le solde' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('refuse côté source la confirmation d’une option non confirmée', async () => {
    const { sources } = renderLot(<ReservationsPage />);
    await expect(sources.baux.sendReservationConfirmation('rs-2026-033')).rejects.toThrow('Confirmez d’abord l’option avant d’envoyer la confirmation.');
    await expect(sources.baux.sendReservationConfirmation('rs-2026-025')).rejects.toThrow('Une réservation annulée ne se confirme pas.');
  });

  it('ouvre le calendrier du bien avec les nuits réservées', async () => {
    renderLot(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Calendrier' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Calendrier des réservations')).toBeTruthy();
  });
});

describe('ReservationContratPage', () => {
  it('affiche le contrat imprimable de la réservation', async () => {
    const { container } = renderLot(<ReservationContratPage id="rs-2026-031" />);
    expect(await screen.findByRole('heading', { name: 'Contrat de location RS-2026-031' })).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('Anna Kowalski');
    expect(text).toContain('7 nuits');
    expect(text).toContain('630 €');
    await expectNoA11yViolations(container);
  });

  it('signale une réservation introuvable', async () => {
    renderLot(<ReservationContratPage id="rs-inconnu" />);
    expect(await screen.findByText('Réservation introuvable', { selector: 'p, h1, h2' })).toBeTruthy();
    expect(at(screen.getAllByRole('link', { name: 'Retour aux réservations' }), 0).getAttribute('href')).toBe('/baux/reservations');
  });
});
