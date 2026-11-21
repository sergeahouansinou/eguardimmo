import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as quotes from './api/quotes.fixtures';
import * as api from './api/responses.fixtures';
import { QuotesPage } from './QuotesPage';
import { maintenanceUrl, renderMaintenance } from './testing';

const list = maintenanceUrl('/quotes');
const suppliers = maintenanceUrl('/suppliers');
const supplierRoute = { [`GET ${suppliers}`]: { body: api.suppliersPage } };

describe('devis de l’agence', () => {
  it('liste les devis avec prestataire, montant, statut, plafond et lien vers l’intervention', async () => {
    const { container } = renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, ...supplierRoute });

    const table = await screen.findByRole('table', { name: 'Devis' });
    const [, submittedRow, receivedRow, ...others] = within(table).getAllByRole('row');
    if (!submittedRow || !receivedRow) throw new Error('Lignes de devis absentes');
    expect(others).toHaveLength(0);
    const submitted = within(submittedRow);
    expect(submitted.getByText(quotes.quoteSubmitted.reference)).toBeTruthy();
    expect(submitted.getByText('Devis initial')).toBeTruthy();
    expect(submitted.getByText(/^720\s€$/)).toBeTruthy();
    expect(submitted.getByText('Soumis au mandant')).toBeTruthy();
    expect(submitted.getByText('En attente')).toBeTruthy();
    expect(submitted.getByText(/^Plafond 500\s€ · avant le 20\/11\/2026$/)).toBeTruthy();
    expect(submitted.getByRole('link', { name: 'INT-2026-0001' }).getAttribute('href')).toBe(`/interventions/${api.IDS.intervention}`);
    await waitFor(() => { expect(submitted.getByText(api.LABELS.supplier)).toBeTruthy(); });
    const received = within(receivedRow);
    expect(received.getByText('Devis complémentaire')).toBeTruthy();
    expect(received.getByText('Reçu')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('rend la liste des devis défilable au clavier', async () => {
    renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, ...supplierRoute });

    const region = await screen.findByRole('region', { name: 'Devis, défilement horizontal' });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table', { name: 'Devis' })).toBeTruthy();
  });

  it('affiche l’état de chargement puis, sans devis, un état vide initial', async () => {
    renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesEmptyPage }, ...supplierRoute });
    expect(screen.getByRole('status', { name: 'Chargement des devis' })).toBeTruthy();
    expect(await screen.findByText('Les devis reçus des prestataires apparaissent ici.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('filtre par statut et par prestataire en repartant de la première page', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<QuotesPage />, { [`GET ${list}`]: (call) => ({ body: call.search.get('status[0]') === 'accepted' ? quotes.quotesEmptyPage : quotes.quotesPage }), ...supplierRoute });
    await screen.findByRole('table', { name: 'Devis' });

    await user.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Accepté' }));
    expect(await screen.findByText('Aucun devis ne correspond à ces filtres.')).toBeTruthy();
    expect(callsTo('GET', list).some((call) => call.search.get('status[0]') === 'accepted')).toBe(true);

    await user.click(screen.getByRole('combobox', { name: /^Prestataire/ }));
    await user.click(await screen.findByRole('option', { name: api.LABELS.supplier }));
    await waitFor(() => { expect(callsTo('GET', list).some((call) => call.search.get('supplier_party_id') === api.IDS.supplierParty && call.search.get('status[0]') === 'accepted')).toBe(true); });
  });

  it('restreint à une intervention depuis le lien et propose de retirer le filtre', async () => {
    const { callsTo } = renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, ...supplierRoute }, { search: `intervention=${api.IDS.intervention}` });
    await screen.findByRole('table', { name: 'Devis' });
    expect(callsTo('GET', list)[0]?.search.get('intervention_id')).toBe(api.IDS.intervention);
    expect(screen.getByRole('link', { name: 'Retirer ce filtre' }).getAttribute('href')).toBe('/devis');
  });

  it('ignore un paramètre d’intervention qui n’est pas un identifiant', async () => {
    const { callsTo } = renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, ...supplierRoute }, { search: 'intervention=pas-un-uuid' });
    await screen.findByRole('table', { name: 'Devis' });
    expect(callsTo('GET', list)[0]?.search.has('intervention_id')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Retirer ce filtre' })).toBeNull();
  });

  it('charge la page suivante par curseur et l’ajoute à la liste', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<QuotesPage />, { [`GET ${list}`]: (call) => ({ body: call.search.get('cursor') === 'curseur-2' ? quotes.quotesSecondPage : quotes.quotesFirstPage }), ...supplierRoute });
    await screen.findByRole('table', { name: 'Devis' });
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Charger plus de devis' }));

    await waitFor(() => { expect(screen.getAllByRole('row')).toHaveLength(3); });
    expect(callsTo('GET', list).some((call) => call.search.get('cursor') === 'curseur-2')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Charger plus de devis' })).toBeNull();
  });

  it('affiche l’erreur traduite et recharge avec « Réessayer »', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderMaintenance(<QuotesPage />, {
      [`GET ${list}`]: () => {
        calls += 1;
        return calls === 1 ? { status: 503, body: api.problemBody(503, 'service_unavailable', 'KO') } : { body: quotes.quotesPage };
      },
      ...supplierRoute,
    });
    expect(await screen.findByText('Les devis n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByText('Le service des interventions est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table', { name: 'Devis' })).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('garde les devis déjà chargés quand la page suivante échoue, avec un nouvel essai', async () => {
    const user = userEvent.setup();
    let next = 0;
    renderMaintenance(<QuotesPage />, {
      [`GET ${list}`]: (call) => {
        if (call.search.get('cursor') !== 'curseur-2') return { body: quotes.quotesFirstPage };
        next += 1;
        return next === 1 ? { status: 403, body: api.problemBody(403, 'forbidden', 'Interdit') } : { body: quotes.quotesSecondPage };
      },
      ...supplierRoute,
    });
    await screen.findByRole('table', { name: 'Devis' });
    await user.click(screen.getByRole('button', { name: 'Charger plus de devis' }));

    expect(await screen.findByText('La page suivante n’a pas pu être chargée')).toBeTruthy();
    expect(screen.getByText('Votre rôle ne permet pas cette action sur les interventions.')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => { expect(screen.getAllByRole('row')).toHaveLength(3); });
  });

  it('reste lisible quand les prestataires ne se chargent pas', async () => {
    renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, [`GET ${suppliers}`]: { status: 503, body: api.problemBody(503, 'service_unavailable', 'KO') } });
    const table = await screen.findByRole('table', { name: 'Devis' });
    expect(within(table).queryByText(api.LABELS.supplier)).toBeNull();
    await waitFor(() => { expect(screen.getByRole('combobox', { name: /^Prestataire/ }).hasAttribute('disabled')).toBe(true); });
  });

  it('sert le comptable en lecture et refuse un compte sans rôle', async () => {
    renderMaintenance(<QuotesPage />, { [`GET ${list}`]: { body: quotes.quotesPage }, ...supplierRoute }, { role: 'accountant' });
    expect(await screen.findByRole('table', { name: 'Devis' })).toBeTruthy();
  });

  it('n’appelle pas le serveur sans rôle connu', async () => {
    const { calls } = renderMaintenance(<QuotesPage />, {}, { role: null });
    expect(await screen.findByText('Interventions indisponibles pour ce compte')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
