import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import * as api from './api/responses.fixtures';
import { InvoiceFormPage } from './InvoiceFormPage';
import { invoicingUrl, renderInvoicing } from './testing';

const listPath = invoicingUrl('/invoices');
const draftPath = invoicingUrl(`/invoices/${api.IDS.draft}`);

async function pick(name: RegExp | string, option: RegExp | string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

const pickRecipient = () => pick(/^Destinataire/, /^SCI Les Tilleuls/);

async function fillFirstLine() {
  await pick(/^Nature, ligne 1/, 'Honoraires de gestion');
  await userEvent.type(screen.getByRole('textbox', { name: /^Libellé, ligne 1/ }), 'Honoraires de gestion, novembre 2026');
  await userEvent.clear(screen.getByRole('textbox', { name: /^Quantité, ligne 1/ }));
  await userEvent.type(screen.getByRole('textbox', { name: /^Quantité, ligne 1/ }), '1');
  await userEvent.type(screen.getByRole('textbox', { name: /^Prix unitaire HT/ }), '100');
}

describe('nouvelle facture', () => {
  it('crée un brouillon à plusieurs lignes, sans taux ni total envoyés, puis ouvre le détail', async () => {
    const { callsTo, push, container } = renderInvoicing(<InvoiceFormPage />, { [`POST ${listPath}`]: { status: 201, body: api.draftCreated } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Nouvelle facture' })).toBeTruthy();
    await expectNoA11yViolations(container);

    await pickRecipient();
    await fillFirstLine();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }));
    await pick(/^Nature, ligne 2/, 'Prestation de services');
    await userEvent.type(screen.getByRole('textbox', { name: /^Libellé, ligne 2/ }), 'Frais de dossier');
    await userEvent.type(screen.getByRole('textbox', { name: /^Prix unitaire HT.*ligne 2/ }), '49,50');
    await pick(/^Catégorie de taxe, ligne 2/, 'Exonéré (E)');
    expect(screen.getByText(/Total hors taxe indicatif : 149,50 €/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => { expect(callsTo('POST', listPath)).toHaveLength(1); });
    const body = callsTo('POST', listPath)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ recipient_party_id: api.IDS.party });
    expect(body.lines).toEqual([
      expect.objectContaining({ description: 'Honoraires de gestion, novembre 2026', quantity_milli: 1000, unit_price: 10000, tax_category: 'S' }),
      expect.objectContaining({ description: 'Frais de dossier', quantity_milli: 1000, unit_price: 4950, tax_category: 'E' }),
    ]);
    for (const forbidden of ['total_net', 'total_tax', 'total_gross', 'number', 'status', 'issued_on', 'tax_rate_pcm', 'currency']) expect(JSON.stringify(body)).not.toContain(forbidden);
    expect(String(body.idempotency_key)).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/factures/${api.IDS.draft}`); });
  });

  it('pré-sélectionne le destinataire passé dans l’adresse', async () => {
    const { callsTo } = renderInvoicing(<InvoiceFormPage />, { [`POST ${listPath}`]: { status: 201, body: api.draftCreated } }, { search: `destinataire=${api.IDS.party}` });
    await fillFirstLine();
    await waitFor(() => { expect(screen.getByRole('combobox', { name: /^Destinataire/ }).textContent).toContain('SCI Les Tilleuls'); });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => { expect(callsTo('POST', listPath)).toHaveLength(1); });
    expect(callsTo('POST', listPath)[0]?.body).toMatchObject({ recipient_party_id: api.IDS.party });
  });

  it('exige un destinataire et refuse un prix invalide sans aucun appel', async () => {
    const { callsTo } = renderInvoicing(<InvoiceFormPage />, {});
    await screen.findByRole('heading', { level: 1, name: 'Nouvelle facture' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Choisissez le destinataire de la facture.')).toBeTruthy();

    await pickRecipient();
    await userEvent.type(screen.getByRole('textbox', { name: /^Prix unitaire HT/ }), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon non enregistré')).toBeTruthy();
    expect(callsTo('POST', listPath)).toHaveLength(0);
  });

  it('rejoue la même clé d’idempotence après une panne, sans doublon', async () => {
    let attempts = 0;
    const { callsTo } = renderInvoicing(<InvoiceFormPage />, { [`POST ${listPath}`]: () => { attempts += 1; return attempts === 1 ? { status: 503, body: api.problemPdfUnavailable } : { status: 200, body: api.draftCreated }; } });
    await screen.findByRole('heading', { level: 1, name: 'Nouvelle facture' });
    await pickRecipient();
    await fillFirstLine();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon non enregistré')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => { expect(callsTo('POST', listPath)).toHaveLength(2); });
    const keys = callsTo('POST', listPath).map((call) => (call.body as { idempotency_key: string }).idempotency_key);
    expect(keys[0]).toBe(keys[1]);
  });

  it('affiche l’erreur de validation du serveur', async () => {
    renderInvoicing(<InvoiceFormPage />, { [`POST ${listPath}`]: { status: 422, body: api.problemValidation('lines.0.description') } });
    await screen.findByRole('heading', { level: 1, name: 'Nouvelle facture' });
    await pickRecipient();
    await fillFirstLine();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Brouillon non enregistré')).toBeTruthy();
  });

  it('refuse l’accès à une organisation individuelle', async () => {
    renderInvoicing(<InvoiceFormPage />, {}, { kind: 'individual', role: 'owner' });
    expect(await screen.findByText('Facturation indisponible pour ce compte')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).toBeNull();
  });
});

describe('modification d’un brouillon', () => {
  const routes = { [`GET ${draftPath}`]: { body: api.draftDetail } };

  it('préremplit les lignes et enregistre avec la version de verrou', async () => {
    const { callsTo, push, container } = renderInvoicing(<InvoiceFormPage id={api.IDS.draft} />, { ...routes, [`PATCH ${draftPath}`]: { body: api.draftUpdated } });
    expect(await screen.findByRole('textbox', { name: /^Libellé, ligne 1/ })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /^Libellé, ligne 1/ }).value).toBe('Honoraires de gestion, novembre 2026');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /^Prix unitaire HT/ }).value).toBe('100,00');
    await expectNoA11yViolations(container);

    await userEvent.type(screen.getByRole('textbox', { name: /^Libellé, ligne 1/ }), ' (corrigé)');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => { expect(callsTo('PATCH', draftPath)).toHaveLength(1); });
    expect(callsTo('PATCH', draftPath)[0]?.body).toMatchObject({ lock_version: 0, lines: [expect.objectContaining({ description: 'Honoraires de gestion, novembre 2026 (corrigé)', unit_price: 10000 })] });
    expect(JSON.stringify(callsTo('PATCH', draftPath)[0]?.body)).not.toContain('idempotency_key');
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/factures/${api.IDS.draft}`); });
  });

  it('signale un brouillon modifié entre-temps (409)', async () => {
    renderInvoicing(<InvoiceFormPage id={api.IDS.draft} />, { ...routes, [`PATCH ${draftPath}`]: { status: 409, body: api.problemStaleVersion } });
    await screen.findByRole('textbox', { name: /^Libellé, ligne 1/ });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Ce brouillon a été modifié depuis votre lecture : rechargez la page avant de l’enregistrer.')).toBeTruthy();
  });

  it('ne laisse pas modifier une facture émise', async () => {
    renderInvoicing(<InvoiceFormPage id={api.IDS.issued} />, { [`GET ${invoicingUrl(`/invoices/${api.IDS.issued}`)}`]: { body: api.issuedDetail } });
    expect(await screen.findByText('Cette facture n’est plus un brouillon')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('signale un brouillon introuvable', async () => {
    renderInvoicing(<InvoiceFormPage id={api.IDS.draft} />, { [`GET ${draftPath}`]: { status: 404, body: api.problemNotFound } });
    expect(await screen.findByText('Ce brouillon n’existe pas')).toBeTruthy();
  });
});
