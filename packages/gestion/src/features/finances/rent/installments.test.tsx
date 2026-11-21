import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { InstallmentsPage } from './InstallmentsPage';
import { installmentRows, installmentsPage, leaseReference, listRoutes, pageOf, renderRent, rentUrl, rowAt } from './testing';

const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const rowMenu = async (row: HTMLElement) => {
  await userEvent.click(within(row).getByRole('button', { name: /^Actions pour l’échéance/ }));
};

describe('liste des échéances', () => {
  it('affiche les échéances du serveur avec montants, reste dû et statuts', async () => {
    const { container } = renderRent(<InstallmentsPage />, listRoutes());

    const table = await screen.findByRole('table', { name: 'Échéances de loyer' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Échéance', 'Période', 'Bail', 'Loyer', 'Charges', 'Total', 'Reste dû', 'Statut', 'Actions']);
    const [upcoming, partial, paid] = rowsOf(table).map((row) => norm(row.textContent));
    expect(upcoming).toContain('05/11/2026');
    expect(upcoming).toContain('Novembre 2026');
    expect(upcoming).toContain(leaseReference);
    expect(upcoming).toContain('650 €');
    expect(upcoming).toContain('50 €');
    expect(upcoming).toContain('700 €');
    expect(upcoming).toContain('À venir');
    expect(partial).toContain('Partiellement payée');
    expect(partial).toContain('En retard');
    expect(partial).toContain('300 €');
    expect(paid).toContain('Payée');
    expect(document.body.textContent).not.toContain('Sophie Delmas');
    await expectNoA11yViolations(container);
  });

  it('envoie les filtres choisis au serveur et revient à la première page', async () => {
    const { callsTo } = renderRent(<InstallmentsPage />, listRoutes());
    await screen.findByRole('table', { name: 'Échéances de loyer' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Partiellement payée' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'En retard seulement' }));

    await waitFor(() => {
      const last = callsTo('GET', rentUrl('/installments')).at(-1);
      expect(Object.fromEntries(last?.search ?? [])).toEqual({ per_page: '25', status: 'partially_paid', overdue: '1' });
    });
  });

  it('pagine avec le curseur du serveur', async () => {
    const { callsTo } = renderRent(<InstallmentsPage />, {
      [`GET ${rentUrl('/installments')}`]: (call) => (call.search.get('cursor') === null ? { body: installmentsPage('curseur-2') } : { body: pageOf(api.upcomingPage, [installmentRows[2]]) }),
    });
    await screen.findByRole('table', { name: 'Échéances de loyer' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Précédent' }).disabled).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => { expect(callsTo('GET', rentUrl('/installments')).at(-1)?.search.get('cursor')).toBe('curseur-2'); });
    await waitFor(() => { expect(rowsOf(screen.getByRole('table', { name: 'Échéances de loyer' }))).toHaveLength(1); });
    expect(screen.getByText('Page 2')).toBeTruthy();
  });

  it('affiche l’état vide, filtré ou non', async () => {
    renderRent(<InstallmentsPage />, { [`GET ${rentUrl('/installments')}`]: { body: pageOf(api.upcomingPage, []) } });
    expect(await screen.findByText('Aucune échéance')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Échéances de loyer' })).toBeNull();
  });

  it('signale l’erreur du serveur au lieu d’afficher une liste vide', async () => {
    renderRent(<InstallmentsPage />, { [`GET ${rentUrl('/installments')}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur les loyers.')).toBeTruthy();
    expect(screen.queryByText('Aucune échéance')).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderRent(<InstallmentsPage />, listRoutes());
    expect(screen.getByRole('status', { name: 'Chargement des échéances' })).toBeTruthy();
  });
});

describe('droits des boutons', () => {
  it('donne au gestionnaire génération, émission en lot et enregistrement de paiement', async () => {
    renderRent(<InstallmentsPage />, listRoutes(), { role: 'manager' });
    await screen.findByRole('table', { name: 'Échéances de loyer' });
    expect(screen.getByRole('button', { name: 'Générer les échéances' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Émettre les avis échus' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Enregistrer un paiement' }).getAttribute('href')).toBe('/finances/loyers/paiements/nouveau');
  });

  it('ne laisse au comptable que la lecture et l’enregistrement d’un paiement', async () => {
    renderRent(<InstallmentsPage />, listRoutes(), { role: 'accountant' });
    const table = await screen.findByRole('table', { name: 'Échéances de loyer' });

    expect(screen.queryByRole('button', { name: 'Générer les échéances' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Émettre les avis échus' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Enregistrer un paiement' })).toBeTruthy();
        expect(within(rowAt(table, 0)).queryByRole('button', { name: /^Actions pour/ })).toBeNull();
    await rowMenu(rowAt(table, 1));
    expect(await screen.findByRole('menuitem', { name: 'Enregistrer un paiement' })).toBeTruthy();
    for (const name of ['Émettre l’avis d’échéance', 'Annuler l’échéance', 'Émettre la quittance']) expect(screen.queryByRole('menuitem', { name })).toBeNull();
  });
});

describe('actions sur une échéance', () => {
  it('émet l’avis après confirmation, sans appel avant', async () => {
    const issued = { data: { ...api.issuedDetail.data, id: api.IDS.janInstallment } };
    const { callsTo } = renderRent(<InstallmentsPage />, { ...listRoutes(), [`POST ${rentUrl(`/installments/${api.IDS.janInstallment}/issue`)}`]: { body: issued } });
    const table = await screen.findByRole('table', { name: 'Échéances de loyer' });

    await rowMenu(rowAt(table, 0));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Émettre l’avis d’échéance' }));
    expect(callsTo('POST', rentUrl(`/installments/${api.IDS.janInstallment}/issue`))).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre l’avis' }));

    await waitFor(() => { expect(callsTo('POST', rentUrl(`/installments/${api.IDS.janInstallment}/issue`))).toHaveLength(1); });
    expect(await screen.findByText('Avis d’échéance émis')).toBeTruthy();
    expect(screen.getByText(/avis AV-2026-0001/)).toBeTruthy();
  });

  it('exige un motif avant d’annuler une échéance, puis l’envoie', async () => {
    const { callsTo } = renderRent(<InstallmentsPage />, { ...listRoutes(), [`POST ${rentUrl(`/installments/${api.IDS.janInstallment}/cancel`)}`]: { body: api.cancelledDetail } });
    const table = await screen.findByRole('table', { name: 'Échéances de loyer' });

    await rowMenu(rowAt(table, 0));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler l’échéance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’échéance' }));
    expect(within(dialog).getByText('Indiquez un motif de 2 à 255 caractères.')).toBeTruthy();
    expect(callsTo('POST', rentUrl(`/installments/${api.IDS.janInstallment}/cancel`))).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Erreur de génération');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’échéance' }));

    await waitFor(() => { expect(callsTo('POST', rentUrl(`/installments/${api.IDS.janInstallment}/cancel`))[0]?.body).toEqual({ reason: 'Erreur de génération' }); });
    expect(await screen.findByText('Échéance annulée')).toBeTruthy();
  });

  it('traduit le refus d’annuler une échéance déjà encaissée', async () => {
    renderRent(<InstallmentsPage />, { ...listRoutes(), [`POST ${rentUrl(`/installments/${api.IDS.janInstallment}/cancel`)}`]: { status: 409, body: api.problemHasPayments } });
    const table = await screen.findByRole('table', { name: 'Échéances de loyer' });

    await rowMenu(rowAt(table, 0));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler l’échéance' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Erreur');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler l’échéance' }));

    expect(await screen.findByText('Annulation impossible')).toBeTruthy();
    expect(screen.getByText('Cette échéance a reçu des encaissements : annulez-les avant d’annuler l’échéance.')).toBeTruthy();
  });

  it('émet les avis échus après confirmation et résume le résultat', async () => {
    const { callsTo } = renderRent(<InstallmentsPage />, { ...listRoutes(), [`POST ${rentUrl('/installments/issue-due')}`]: { body: api.batchFailed } });
    await screen.findByRole('table', { name: 'Échéances de loyer' });

    await userEvent.click(screen.getByRole('button', { name: 'Émettre les avis échus' }));
    expect(callsTo('POST', rentUrl('/installments/issue-due'))).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre les avis' }));

    expect(await screen.findByText(/1 en échec : le service PDF peut être indisponible/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('ApiProblem');
  });

  it('génère les échéances d’un bail choisi', async () => {
    const { callsTo } = renderRent(<InstallmentsPage />, { ...listRoutes(), [`POST ${rentUrl(`/leases/${api.IDS.lease}/installments/generate`)}`]: { body: api.generation } });
    await screen.findByRole('table', { name: 'Échéances de loyer' });

    await userEvent.click(screen.getByRole('button', { name: 'Générer les échéances' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Bail/ }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(leaseReference) }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Générer' }));

    await waitFor(() => { expect(callsTo('POST', rentUrl(`/leases/${api.IDS.lease}/installments/generate`))).toHaveLength(1); });
    expect(await screen.findByText('1 créée(s), 1 déjà existante(s).')).toBeTruthy();
  });
});
