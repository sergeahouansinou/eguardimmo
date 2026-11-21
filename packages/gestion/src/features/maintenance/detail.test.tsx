import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as api from './api/responses.fixtures';
import { InterventionDetailPage } from './InterventionDetailPage';
import { maintenanceUrl, renderMaintenance } from './testing';
import type { MockRoute } from './api/testing';

const at = (path = '') => maintenanceUrl(`/interventions/${api.IDS.intervention}${path}`);
const show = (body: unknown): Record<string, MockRoute> => ({ [`GET ${at()}`]: { body } });
const menuButton = () => screen.findByRole('button', { name: 'Actions sur l’intervention' });

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await menuButton());
  await user.click(await screen.findByRole('menuitem', { name }));
}

describe('fiche d’une intervention signalée', () => {
  it('affiche synthèse, pièces, journal et actions du rôle propriétaire', async () => {
    const { container } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, show(api.reportedDetail));

    expect(await screen.findByRole('heading', { level: 1, name: api.LABELS.title })).toBeTruthy();
    expect(screen.getAllByText('INT-2026-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Signalée').length).toBeGreaterThan(0);
    expect(screen.getByText(api.LABELS.property, { exact: false })).toBeTruthy();
    expect(screen.getByText('Photo avant travaux')).toBeTruthy();
    expect(screen.getByText('Intervention signalée')).toBeTruthy();
    await user_openMenu();
    expect(screen.getByRole('menuitem', { name: 'Qualifier' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Classer sans suite' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Clôturer' })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('qualifie avec la version lue et les montants en unités mineures', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, { ...show(api.reportedDetail), [`POST ${at('/qualify')}`]: { body: api.ack(api.IDS.intervention) } });
    await choose(user, 'Qualifier');
    const dialog = await screen.findByRole('dialog', { name: 'Qualifier l’intervention' });

    await user.type(within(dialog).getByLabelText('Estimation hors engagement'), '420,50');
    await user.click(within(dialog).getByRole('button', { name: 'Qualifier' }));

    await waitFor(() => { expect(callsTo('POST', at('/qualify'))).toHaveLength(1); });
    expect(callsTo('POST', at('/qualify'))[0]?.body).toMatchObject({ lock_version: 1, priority: 'normal', estimated_amount: 42050, nature_term_id: api.IDS.nature });
  });

  it('recharge et prévient quand la version a changé (409)', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      [`GET ${at()}`]: () => { reads += 1; return { body: api.reportedDetail }; },
      [`POST ${at('/qualify')}`]: { status: 409, body: api.problemBody(409, 'intervention_stale_version', 'Stale') },
    });
    await choose(user, 'Qualifier');
    const dialog = await screen.findByRole('dialog', { name: 'Qualifier l’intervention' });
    await user.click(within(dialog).getByRole('button', { name: 'Qualifier' }));

    expect(await screen.findByText('Intervention modifiée entre-temps')).toBeTruthy();
    await waitFor(() => { expect(reads).toBeGreaterThan(1); });
    expect(callsTo('POST', at('/qualify'))).toHaveLength(1);
    expect(screen.queryByRole('dialog', { name: 'Qualifier l’intervention' })).toBeNull();
  });

  it('classe sans suite avec motif et explication', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, { ...show(api.reportedDetail), [`POST ${at('/decline')}`]: { body: api.ack(api.IDS.intervention) } });
    await choose(user, 'Classer sans suite');
    const dialog = await screen.findByRole('dialog', { name: 'Classer sans suite' });

    await user.click(within(dialog).getByRole('button', { name: 'Classer sans suite' }));
    expect(await within(dialog).findByText('La note doit contenir entre 3 et 500 caractères.')).toBeTruthy();
    expect(callsTo('POST', at('/decline'))).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Explication/), 'Doublon du 10 novembre');
    await user.click(within(dialog).getByRole('button', { name: 'Classer sans suite' }));
    await waitFor(() => { expect(callsTo('POST', at('/decline'))).toHaveLength(1); });
    expect(callsTo('POST', at('/decline'))[0]?.body).toEqual({ lock_version: 1, reason: 'other', note: 'Doublon du 10 novembre' });
  });

  it('annule après confirmation', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, { ...show(api.reportedDetail), [`POST ${at('/cancel')}`]: { body: api.ack(api.IDS.intervention) } });
    await choose(user, 'Annuler l’intervention');
    await user.click(await screen.findByRole('button', { name: 'Annuler l’intervention' }));
    await waitFor(() => { expect(callsTo('POST', at('/cancel'))).toHaveLength(1); });
    expect(callsTo('POST', at('/cancel'))[0]?.body).toEqual({ lock_version: 1 });
  });

  it('affiche un message clair quand l’intervention est introuvable', async () => {
    renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, { [`GET ${at()}`]: { status: 404, body: api.problemBody(404, 'intervention_not_found', 'x') } });
    expect(await screen.findByText('Intervention introuvable')).toBeTruthy();
  });

  it('ajoute un commentaire avec ses visibilités', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, { ...show(api.reportedDetail), [`POST ${at('/comments')}`]: { status: 201, body: api.ack(api.IDS.event) } });
    await user.type(await screen.findByLabelText('Nouveau commentaire'), 'Le plombier passe jeudi');
    await user.click(screen.getByRole('checkbox', { name: 'Visible par le locataire' }));
    await user.click(screen.getByRole('button', { name: 'Commenter' }));
    await waitFor(() => { expect(callsTo('POST', at('/comments'))).toHaveLength(1); });
    expect(callsTo('POST', at('/comments'))[0]?.body).toEqual({ text: 'Le plombier passe jeudi', visible_to_tenant: true, visible_to_owner: false });
  });
});

async function user_openMenu() {
  await userEvent.click(await menuButton());
}

describe('rôles', () => {
  it('un comptable ne voit aucune action sur le cycle de vie ni sur les commentaires', async () => {
    renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, show(api.reportedDetail), { role: 'accountant' });
    expect(await screen.findByRole('heading', { level: 1, name: api.LABELS.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Actions sur l’intervention' })).toBeNull();
    expect(screen.queryByLabelText('Nouveau commentaire')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajouter une pièce' })).toBeNull();
  });

  it('un responsable gère l’intervention mais ne règle ni n’impute', async () => {
    const user = userEvent.setup();
    renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, show(api.advancedWithInvoiceDetail), { role: 'manager' });
    await screen.findByText(`Facture ${api.LABELS.invoiceNumber}`);
    await user.click(screen.getByRole('button', { name: `Actions pour la facture ${api.LABELS.invoiceNumber}` }));
    expect(screen.queryByRole('menuitem', { name: 'Imputer la facture' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Enregistrer un règlement' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Annuler la facture' })).toBeTruthy();
  });

  it('un comptable impute et règle mais ne modifie pas les devis ni l’accord', async () => {
    const user = userEvent.setup();
    renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, show(api.advancedWithInvoiceDetail), { role: 'accountant' });
    await screen.findByText(`Facture ${api.LABELS.invoiceNumber}`);
    expect(screen.queryByRole('button', { name: 'Actions pour la demande d’accord' })).toBeNull();
    expect(screen.queryByRole('button', { name: `Actions pour le devis ${api.LABELS.quoteReference}` })).toBeNull();
    await user.click(screen.getByRole('button', { name: `Actions pour la facture ${api.LABELS.invoiceNumber}` }));
    expect(screen.getByRole('menuitem', { name: 'Imputer la facture' })).toBeTruthy();
  });
});
