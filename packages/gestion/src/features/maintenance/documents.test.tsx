import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as api from './api/responses.fixtures';
import { InterventionDetailPage } from './InterventionDetailPage';
import { maintenanceUrl, renderMaintenance } from './testing';
import type { MockRoute } from './api/testing';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const at = (path = '') => maintenanceUrl(`/interventions/${api.IDS.intervention}${path}`);
const show = (body: unknown): Record<string, MockRoute> => ({ [`GET ${at()}`]: { body } });
const pdf = (name = 'piece.pdf') => new File(['%PDF'], name, { type: 'application/pdf' });
const uploaded = (id: string, kind: string) => ({ status: 201, body: { data: { id, intervention_id: api.IDS.intervention, kind, uploaded_by_kind: 'team', visible_to_owner: false, visible_to_tenant: false, created_at: null } } });

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, label: string, item: string) {
  await user.click(await screen.findByRole('button', { name: label }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('décision du mandant', () => {
  const decisionPath = at(`/approvals/${api.IDS.approval}/record-decision`);

  it('refuse d’enregistrer sans pièce écrite, sans appel réseau', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, show(api.advancedDetail));
    await openRowMenu(user, 'Actions pour la demande d’accord', 'Enregistrer la décision du mandant');
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer la décision du mandant' });

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la décision' }));

    expect(await within(dialog).findByText('Joignez la pièce écrite du mandant (courriel, courrier ou message).')).toBeTruthy();
    expect(callsTo('POST', decisionPath)).toHaveLength(0);
    expect(callsTo('POST', at('/files'))).toHaveLength(0);
  });

  it('téléverse la pièce puis enregistre la décision avec son identifiant', async () => {
    const user = userEvent.setup();
    const { calls } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.advancedDetail),
      [`POST ${at('/files')}`]: uploaded(api.IDS.proof, 'proof'),
      [`POST ${decisionPath}`]: { body: api.ack(api.IDS.approval, { replayed: false }) },
    });
    await openRowMenu(user, 'Actions pour la demande d’accord', 'Enregistrer la décision du mandant');
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer la décision du mandant' });

    await user.upload(within(dialog).getByLabelText(/Pièce écrite du mandant/), pdf('accord.pdf'));
    await user.type(within(dialog).getByLabelText('Commentaire'), 'Accord par courriel du 14/11');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la décision' }));

    await waitFor(() => { expect(calls.filter((call) => call.method === 'POST').map((call) => call.path)).toEqual([at('/files'), decisionPath]); });
    const decision = calls.find((call) => call.path === decisionPath);
    expect(decision?.body).toEqual({ decision: 'accept', comment: 'Accord par courriel du 14/11', proof_file_id: api.IDS.proof });
  });

  it('ne retéléverse pas la pièce quand le serveur refuse la décision puis qu’on réessaie', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.advancedDetail),
      [`POST ${at('/files')}`]: uploaded(api.IDS.proof, 'proof'),
      [`POST ${decisionPath}`]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 409, body: api.problemBody(409, 'approval_already_decided', 'x') } : { body: api.ack(api.IDS.approval, { replayed: false }) };
      },
    });
    await openRowMenu(user, 'Actions pour la demande d’accord', 'Enregistrer la décision du mandant');
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer la décision du mandant' });
    await user.upload(within(dialog).getByLabelText(/Pièce écrite du mandant/), pdf());

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la décision' }));
    expect(await within(dialog).findByText(/a déjà reçu une décision/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la décision' }));

    await waitFor(() => { expect(callsTo('POST', decisionPath)).toHaveLength(2); });
    expect(callsTo('POST', at('/files'))).toHaveLength(1);
  });
});

describe('devis', () => {
  it('calcule le total hors taxe et envoie des entiers bruts avec la pièce téléversée', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.advancedDetail),
      [`POST ${at('/files')}`]: uploaded(api.IDS.file, 'quote'),
      [`POST ${at('/quotes')}`]: { status: 201, body: api.ack(api.IDS.quote) },
    });
    await user.click(await screen.findByRole('button', { name: 'Enregistrer un devis' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer un devis' });
    await user.type(within(dialog).getByLabelText('Référence du devis *'), 'DEV-900');
    await user.upload(within(dialog).getByLabelText(/Devis du prestataire/), pdf('devis.pdf'));
    await user.type(within(dialog).getByLabelText('Libellé de la ligne 1'), 'Main d’œuvre');
    await user.clear(within(dialog).getByLabelText('Quantité 1'));
    await user.type(within(dialog).getByLabelText('Quantité 1'), '2,5');
    await user.type(within(dialog).getByLabelText('Prix unitaire HT 1'), '80');
    await user.click(within(dialog).getByRole('combobox', { name: /^Taux de taxe 1/ }));
    await user.click(await screen.findByRole('option', { name: 'TVA 20 %' }));

    expect(within(dialog).getByText('Total HT calculé : 200 €')).toBeTruthy();
    await expectNoA11yViolations(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le devis' }));

    await waitFor(() => { expect(callsTo('POST', at('/quotes'))).toHaveLength(1); });
    expect(callsTo('POST', at('/quotes'))[0]?.body).toMatchObject({
      reference: 'DEV-900', kind: 'initial', file_id: api.IDS.file, lines: [{ label: 'Main d’œuvre', quantity_milli: 2500, unit_price: 8000, tax_rate_key: 'fr_vat_normal' }],
    });
  });

  it('soumet un devis reçu au mandant et accepte un devis soumis', async () => {
    const user = userEvent.setup();
    const received = { data: { ...api.advancedDetail.data, quotes: [{ ...api.advancedDetail.data.quotes[0], status: 'received' }] } };
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(received),
      [`POST ${at(`/quotes/${api.IDS.quote}/submit`)}`]: { body: api.ack(api.IDS.quote) },
    });
    await openRowMenu(user, `Actions pour le devis ${api.LABELS.quoteReference}`, 'Soumettre au mandant');
    await waitFor(() => { expect(callsTo('POST', at(`/quotes/${api.IDS.quote}/submit`))).toHaveLength(1); });
  });
});

describe('facture du prestataire, imputation et règlement', () => {
  const invoicesPath = at('/invoices');
  const base = { data: { ...api.advancedDetail.data, status: 'completed', invoices: [], approvals: [] } };

  it('réutilise la même clé d’idempotence après un échec, puis en change si la saisie change', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(base),
      [`POST ${at('/files')}`]: uploaded(api.IDS.file, 'invoice'),
      [`POST ${invoicesPath}`]: () => {
        attempts += 1;
        return attempts <= 2 ? { status: 503, body: api.problemBody(503, 'service_unavailable', 'x') } : { status: 201, body: api.ack(api.IDS.invoice, { replayed: false }) };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Enregistrer une facture' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer la facture du prestataire' });
    await user.type(within(dialog).getByLabelText('Numéro de facture *'), 'F-2026-200');
    await user.upload(within(dialog).getByLabelText(/Facture du prestataire/), pdf('facture.pdf'));
    await user.click(within(dialog).getByRole('combobox', { name: /^Taux de taxe 1/ }));
    await user.click(await screen.findByRole('option', { name: 'TVA 20 %' }));
    await user.type(within(dialog).getByLabelText('Base HT 1'), '100');
    await user.type(within(dialog).getByLabelText('Taxe 1'), '20');

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la facture' }));
    await within(dialog).findByText(/momentanément indisponible/);
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la facture' }));
    await waitFor(() => { expect(callsTo('POST', invoicesPath)).toHaveLength(2); });
    await user.type(within(dialog).getByLabelText('Taxe 1'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la facture' }));
    await waitFor(() => { expect(callsTo('POST', invoicesPath)).toHaveLength(3); });

    const keys = callsTo('POST', invoicesPath).map((call) => (call.body as { idempotency_key: string }).idempotency_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(callsTo('POST', at('/files'))).toHaveLength(1);
    expect(callsTo('POST', invoicesPath)[0]?.body).toMatchObject({ number: 'F-2026-200', taxes: [{ tax_rate_key: 'fr_vat_normal', base: 10000, tax: 2000 }] });
  });

  it('impute à l’agence ou au dépôt de garantie avec vétusté', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.advancedWithInvoiceDetail),
      [`POST ${at(`/invoices/${api.IDS.invoice}/allocations`)}`]: { status: 201, body: api.ack(api.IDS.allocation, { replayed: false }) },
    });
    await openRowMenu(user, `Actions pour la facture ${api.LABELS.invoiceNumber}`, 'Imputer la facture');
    const dialog = await screen.findByRole('dialog', { name: 'Imputer la facture' });
    expect(within(dialog).getByLabelText<HTMLInputElement>('Part imputée TTC *').value).toBe('720,00');

    await user.click(within(dialog).getByRole('combobox', { name: /^Imputer à/ }));
    await user.click(await screen.findByRole('option', { name: 'Dépôt de garantie' }));
    await user.clear(within(dialog).getByLabelText('Part imputée TTC *'));
    await user.type(within(dialog).getByLabelText('Part imputée TTC *'), '120');
    await user.type(within(dialog).getByLabelText('Vétusté (%)'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Imputer' }));

    await waitFor(() => { expect(callsTo('POST', at(`/invoices/${api.IDS.invoice}/allocations`))).toHaveLength(1); });
    expect(callsTo('POST', at(`/invoices/${api.IDS.invoice}/allocations`))[0]?.body).toMatchObject({ target: 'deposit', share_amount: 12000, wear_basis_points: 1500 });
  });

  it('affiche l’erreur de dépassement renvoyée par le serveur et garde la saisie', async () => {
    const user = userEvent.setup();
    renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.advancedWithInvoiceDetail),
      [`POST ${at(`/invoices/${api.IDS.invoice}/payments`)}`]: { status: 422, body: api.problemBody(422, 'payment_exceeds_outstanding', 'x') },
    });
    await openRowMenu(user, `Actions pour la facture ${api.LABELS.invoiceNumber}`, 'Enregistrer un règlement');
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer un règlement au prestataire' });
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await within(dialog).findByText('Le règlement dépasse le reste à payer de la facture.')).toBeTruthy();
    expect(within(dialog).getByLabelText<HTMLInputElement>('Montant réglé *').value).toBe('720,00');
  });

  it('annule une imputation et un règlement depuis la fiche', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.settledDetail),
      [`POST ${maintenanceUrl(`/allocations/${api.IDS.allocation}/cancel`)}`]: { body: api.ack(api.IDS.allocation) },
      [`POST ${maintenanceUrl(`/supplier-payments/${api.IDS.payment}/cancel`)}`]: { body: api.ack(api.IDS.payment) },
    });
    await user.click(await screen.findByRole('button', { name: /Annuler l’imputation/ }));
    await user.click(await screen.findByRole('button', { name: /Annuler le règlement/ }));
    await waitFor(() => { expect(callsTo('POST', maintenanceUrl(`/allocations/${api.IDS.allocation}/cancel`))).toHaveLength(1); });
    await waitFor(() => { expect(callsTo('POST', maintenanceUrl(`/supplier-payments/${api.IDS.payment}/cancel`))).toHaveLength(1); });
  });
});

describe('engagement, visites et pièces', () => {
  it('exige un motif pour l’engagement en urgence, puis l’envoie', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show({ data: { ...api.advancedDetail.data, status: 'qualified', approvals: [], quotes: [], invoices: [], lock_version: 2 } }),
      [`POST ${at('/engage')}`]: { body: api.ack(api.IDS.intervention) },
    });
    await user.click(await screen.findByRole('button', { name: 'Actions sur l’intervention' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Engager les travaux' }));
    const dialog = await screen.findByRole('dialog', { name: 'Engager les travaux' });
    await user.click(within(dialog).getByRole('combobox', { name: /^Base de l’engagement/ }));
    await user.click(await screen.findByRole('option', { name: 'Urgence (sans accord préalable)' }));

    await user.click(within(dialog).getByRole('button', { name: 'Engager' }));
    expect(await within(dialog).findByText('Indiquez le motif de l’urgence (3 caractères au moins).')).toBeTruthy();
    expect(callsTo('POST', at('/engage'))).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Motif de l’urgence/), 'Dégât des eaux en cours');
    await user.click(within(dialog).getByRole('button', { name: 'Engager' }));
    await waitFor(() => { expect(callsTo('POST', at('/engage'))).toHaveLength(1); });
    expect(callsTo('POST', at('/engage'))[0]?.body).toEqual({ lock_version: 2, basis: 'emergency', reason: 'Dégât des eaux en cours' });
  });

  it('propose une visite et actionne une visite existante', async () => {
    const user = userEvent.setup();
        const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.rescheduleDetail),
      [`POST ${at('/visits')}`]: { status: 201, body: api.ack(api.IDS.visit) },
      [`POST ${at(`/visits/${api.IDS.visit}/confirm`)}`]: { body: api.ack(api.IDS.visit) },
    });
    await user.click(await screen.findByRole('button', { name: 'Proposer une visite' }));
    const dialog = await screen.findByRole('dialog', { name: 'Proposer une visite' });
    await user.type(within(dialog).getByLabelText('Date *'), '2026-11-30');
    await user.click(within(dialog).getByRole('button', { name: 'Proposer la visite' }));
    await waitFor(() => { expect(callsTo('POST', at('/visits'))).toHaveLength(1); });
    expect(callsTo('POST', at('/visits'))[0]?.body).toMatchObject({ scheduled_on: '2026-11-30', slot: 'morning', presence_required: true });

    await openRowMenu(user, 'Actions pour la visite du 20/11/2026', 'Confirmer pour le locataire');
    await waitFor(() => { expect(callsTo('POST', at(`/visits/${api.IDS.visit}/confirm`))).toHaveLength(1); });
  });

  it('ajoute une pièce visible du mandant et partage une pièce interne', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionDetailPage id={api.IDS.intervention} />, {
      ...show(api.reportedDetail),
      [`POST ${at('/files')}`]: uploaded(api.IDS.file, 'report'),
      [`PATCH ${at(`/files/${api.IDS.file}`)}`]: { body: uploaded(api.IDS.file, 'photo_before').body },
    });
    await user.click(await screen.findByRole('button', { name: 'Ajouter une pièce' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter une pièce' });
    await user.upload(within(dialog).getByLabelText('Fichier *'), pdf('compte-rendu.pdf'));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Visible par le mandant' }));
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter la pièce' }));
    await waitFor(() => { expect(callsTo('POST', at('/files'))).toHaveLength(1); });

    await user.click(await screen.findByRole('button', { name: /Partager avec le mandant/ }));
    await waitFor(() => { expect(callsTo('PATCH', at(`/files/${api.IDS.file}`))).toHaveLength(1); });
    expect(callsTo('PATCH', at(`/files/${api.IDS.file}`))[0]?.body).toEqual({ visible_to_owner: true });
  });
});
