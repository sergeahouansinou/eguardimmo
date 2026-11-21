import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { InvoiceDetailPage } from './InvoiceDetailPage';
import { invoicingUrl, renderInvoicing } from './testing';

const path = (id: string, suffix = '') => invoicingUrl(`/invoices/${id}${suffix}`);
const show = (id: string, body: unknown) => ({ [`GET ${path(id)}`]: { body } });

let clicks: MockInstance<() => void>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  clicks.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));

describe('détail d’une facture émise', () => {
  it('affiche lignes, taxes en cent-millièmes, totaux et destinataire', async () => {
    const { container } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, api.issuedDetail));

    expect(await screen.findByRole('heading', { level: 1, name: 'Facture FA-2026-0001' })).toBeTruthy();
    expect((await screen.findAllByText('SCI Les Tilleuls')).length).toBeGreaterThan(0);
    expect(rowsOf(screen.getByRole('table', { name: 'Lignes de la facture' }))).toEqual(['Honoraires de gestion, novembre 20261100 €100 €Taux normal, 20 %']);
    expect(screen.getByText('VAT 20 % sur 100 €')).toBeTruthy();
    const totals = screen.getAllByText('Total TTC').map((node) => norm(node.parentElement?.textContent));
    expect(totals).toHaveLength(2);
    expect(totals).toContain('Total TTC120 €');
    expect(screen.getByText('Aucun règlement enregistré.')).toBeTruthy();
    expect(screen.getByText('Émise')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('affiche une taxe à taux québécois exacte, sans arrondi flottant', async () => {
    const qst = { ...api.issuedDetail.data, taxes: [{ tax_code: 'qst', category: 'S', rate_pcm: 9975, base_amount: 10000, tax_amount: 998 }] };
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, { data: qst }));
    expect(await screen.findByText('QST 9,975 % sur 100 €')).toBeTruthy();
  });

  it('signale une facture en retard', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, api.overdueDetail));
    expect(await screen.findByText('En retard')).toBeTruthy();
  });

  it('affiche les règlements d’une facture partiellement réglée et en annule un après confirmation', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.partial} />, {
      ...show(api.IDS.partial, api.partialDetail),
      [`POST ${invoicingUrl(`/invoice-payments/${api.IDS.payment}/cancel`)}`]: { body: api.paymentCancelled },
    });

    const table = await screen.findByRole('table', { name: 'Règlements enregistrés' });
    expect(rowsOf(table)).toEqual(['16/11/2026VirementVIR-12350 €Enregistré' + 'Annuler le règlement de 50 € du 16/11/2026']);
    await userEvent.click(within(table).getByRole('button', { name: /Annuler/ }));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo('POST', invoicingUrl(`/invoice-payments/${api.IDS.payment}/cancel`))).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler le règlement' }));

    await waitFor(() => { expect(callsTo('POST', invoicingUrl(`/invoice-payments/${api.IDS.payment}/cancel`))).toHaveLength(1); });
    expect(await screen.findByText('Règlement annulé')).toBeTruthy();
  });

  it('n’a ni règlement ni avoir à proposer sur une facture soldée', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.paid} />, show(api.IDS.paid, api.paidDetail));
    await screen.findByRole('heading', { level: 1, name: 'Facture FA-2026-0003' });
    expect(screen.queryByRole('button', { name: 'Enregistrer un règlement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Émettre un avoir' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeTruthy();
  });

  it('masque l’annulation d’un règlement et l’avoir selon le rôle, le serveur restant le contrôle', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.partial} />, show(api.IDS.partial, api.partialDetail), { role: 'manager' });
    await screen.findByRole('table', { name: 'Règlements enregistrés' });
    expect(screen.getByRole('button', { name: 'Enregistrer un règlement' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Émettre un avoir' })).toBeNull();
  });

  it('signale une facture introuvable', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { [`GET ${path(api.IDS.issued)}`]: { status: 404, body: api.problemNotFound } });
    expect(await screen.findByText('Cette facture n’existe pas')).toBeTruthy();
  });

  it('signale une erreur de chargement', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { [`GET ${path(api.IDS.issued)}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur la facturation.')).toBeTruthy();
  });
});

describe('détail d’un brouillon', () => {
  const draftRoutes = show(api.IDS.draft, api.draftDetail);

  it('propose modifier, émettre et abandonner ; jamais règlement', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.draft} />, draftRoutes);
    expect(await screen.findByRole('heading', { level: 1, name: 'Brouillon de facture' })).toBeTruthy();
    for (const name of ['Modifier le brouillon', 'Émettre la facture', 'Abandonner le brouillon']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer un règlement' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Règlements' })).toBeNull();
  });

  it('émet après confirmation et annonce le numéro attribué', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.draft} />, { ...draftRoutes, [`POST ${path(api.IDS.draft, '/issue')}`]: { status: 201, body: api.issuedNow } });
    await userEvent.click(await screen.findByRole('button', { name: 'Émettre la facture' }));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo('POST', path(api.IDS.draft, '/issue'))).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre la facture' }));

    await waitFor(() => { expect(callsTo('POST', path(api.IDS.draft, '/issue'))).toHaveLength(1); });
    expect(await screen.findByText('Facture émise')).toBeTruthy();
    expect(screen.getByText('Facture FA-2026-0001, 120 € TTC.')).toBeTruthy();
  });

  it('affiche clairement l’identité légale incomplète de l’agence', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.draft} />, { ...draftRoutes, [`POST ${path(api.IDS.draft, '/issue')}`]: { status: 422, body: api.problemIssuerIncomplete } });
    await userEvent.click(await screen.findByRole('button', { name: 'Émettre la facture' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre la facture' }));

    expect(await screen.findByText('Émission impossible')).toBeTruthy();
    expect(screen.getByText('Renseignez l’identité légale de votre agence (raison sociale, adresse, SIREN, numéro de TVA) avant d’émettre une facture.')).toBeTruthy();
  });

  it('abandonne après confirmation puis revient à la liste', async () => {
    const { callsTo, push } = renderInvoicing(<InvoiceDetailPage id={api.IDS.draft} />, { ...draftRoutes, [`POST ${path(api.IDS.draft, '/discard')}`]: { body: api.draftDiscarded } });
    await userEvent.click(await screen.findByRole('button', { name: 'Abandonner le brouillon' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abandonner le brouillon' }));

    await waitFor(() => { expect(callsTo('POST', path(api.IDS.draft, '/discard'))).toHaveLength(1); });
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/finances/factures'); });
  });

  it('signale un brouillon abandonné sans aucune action', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.draft} />, show(api.IDS.draft, api.draftDiscarded));
    expect(await screen.findByText('Brouillon abandonné')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Émettre la facture' })).toBeNull();
  });
});

describe('règlement', () => {
  const routes = show(api.IDS.issued, api.issuedDetail);
  const paymentPath = path(api.IDS.issued, '/payments');

  async function openDialog() {
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer un règlement' }));
    return screen.findByRole('dialog', { name: 'Enregistrer un règlement' });
  }

  it('propose le reste dû, envoie le montant en unités mineures avec une clé, et annonce le résultat', async () => {
    const { callsTo, container } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${paymentPath}`]: { status: 201, body: api.paymentRecorded } });
    const dialog = await openDialog();
    const amount = within(dialog).getByRole('textbox', { name: 'Montant reçu *' });
    expect((amount as HTMLInputElement).value).toBe('120,00');
    await expectNoA11yViolations(container);

    await userEvent.clear(amount);
    await userEvent.type(amount, '50');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Référence' }), 'VIR-123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));

    await waitFor(() => { expect(callsTo('POST', paymentPath)).toHaveLength(1); });
    const body = callsTo('POST', paymentPath)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ amount: 5000, method: 'transfer', paid_on: '2026-11-16', reference: 'VIR-123' });
    expect(String(body.idempotency_key)).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body)).not.toContain('currency');
    expect(await screen.findByText('Règlement enregistré')).toBeTruthy();
  });

  it('refuse sans appel un montant nul, invalide ou supérieur au reste dû', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, routes);
    const dialog = await openDialog();
    const amount = within(dialog).getByRole('textbox', { name: 'Montant reçu *' });
    const submit = within(dialog).getByRole('button', { name: 'Enregistrer le règlement' });

    for (const [value, message] of [['0', /strictement positif/], ['abc', /strictement positif/], ['120,01', /dépasse le reste dû \(120 €\)/]] as const) {
      await userEvent.clear(amount);
      await userEvent.type(amount, value);
      await userEvent.click(submit);
      expect(await within(dialog).findByText(message)).toBeTruthy();
    }
    expect(callsTo('POST', paymentPath)).toHaveLength(0);
  });

  it('rejoue la même clé après un échec, puis en prend une nouvelle si la saisie change', async () => {
    let attempts = 0;
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${paymentPath}`]: () => { attempts += 1; return attempts < 3 ? { status: 503, body: api.problemPdfUnavailable } : { status: 200, body: api.paymentReplay }; } });
    const dialog = await openDialog();
    const amount = within(dialog).getByRole('textbox', { name: 'Montant reçu *' });
    await userEvent.clear(amount);
    await userEvent.type(amount, '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));
    await within(dialog).findByText('Règlement non enregistré');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));
    await waitFor(() => { expect(callsTo('POST', paymentPath)).toHaveLength(2); });
    await userEvent.clear(amount);
    await userEvent.type(amount, '60');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));

    await waitFor(() => { expect(callsTo('POST', paymentPath)).toHaveLength(3); });
    const keys = callsTo('POST', paymentPath).map((call) => (call.body as { idempotency_key: string }).idempotency_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(await screen.findByText('Règlement déjà enregistré')).toBeTruthy();
  });

  it('affiche le refus du serveur quand le règlement dépasse le reste dû', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${paymentPath}`]: { status: 422, body: api.problemPaymentExceeds } });
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await within(dialog).findByText('Le règlement dépasse le reste dû de la facture.')).toBeTruthy();
  });
});

describe('avoir', () => {
  const routes = show(api.IDS.issued, api.issuedDetail);
  const creditPath = path(api.IDS.issued, '/credit-notes');

  async function openDialog() {
    await userEvent.click(await screen.findByRole('button', { name: 'Émettre un avoir' }));
    return screen.findByRole('dialog', { name: 'Émettre un avoir' });
  }

  it('émet un avoir total avec motif, sans montant ni ligne', async () => {
    const { callsTo, container } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${creditPath}`]: { status: 201, body: api.creditNoteDetail } });
    const dialog = await openDialog();
    await expectNoA11yViolations(container);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));
    expect(await within(dialog).findByText('Indiquez un motif de 2 à 255 caractères.')).toBeTruthy();
    expect(callsTo('POST', creditPath)).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Remise commerciale');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));

    await waitFor(() => { expect(callsTo('POST', creditPath)).toHaveLength(1); });
    expect(callsTo('POST', creditPath)[0]?.body).toMatchObject({ reason: 'Remise commerciale', full: true });
    expect(Object.keys(callsTo('POST', creditPath)[0]?.body as object).sort()).toEqual(['full', 'idempotency_key', 'reason']);
    expect(await screen.findByText('Avoir émis')).toBeTruthy();
  });

  it('émet un avoir partiel par quantité de ligne d’origine', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${creditPath}`]: { status: 201, body: api.creditNoteDetail } });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Remise commerciale');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Avoir total/ }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Quantité à créditer, ligne 1' }), '0,5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));

    await waitFor(() => { expect(callsTo('POST', creditPath)).toHaveLength(1); });
    expect(callsTo('POST', creditPath)[0]?.body).toMatchObject({ full: false, lines: [{ line_id: api.IDS.line, quantity_milli: 500 }] });
  });

  it('exige au moins une quantité pour un avoir partiel', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, routes);
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Remise commerciale');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Avoir total/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));
    expect(await within(dialog).findByText('Indiquez la quantité à créditer d’au moins une ligne.')).toBeTruthy();
    expect(callsTo('POST', creditPath)).toHaveLength(0);
  });

  it('affiche le plafond du reste dû renvoyé par le serveur', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${creditPath}`]: { status: 422, body: api.problemCreditExceeds } });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Remise commerciale');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre l’avoir' }));
    expect(await within(dialog).findByText('Le cumul des avoirs ne peut pas dépasser le reste dû de la facture.')).toBeTruthy();
  });

  it('présente un avoir avec son motif et le lien vers la facture d’origine', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.creditNote} />, show(api.IDS.creditNote, api.creditNoteDetail));
    expect(await screen.findByRole('heading', { level: 1, name: 'Avoir AF-2026-0001' })).toBeTruthy();
    expect(screen.getByText('Motif : Remise commerciale.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir la facture d’origine' }).getAttribute('href')).toBe(`/finances/factures/${api.IDS.issued}`);
    expect(screen.queryByRole('region', { name: 'Règlements' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer un règlement' })).toBeNull();
  });
});

describe('PDF et envoi', () => {
  const routes = show(api.IDS.issued, api.issuedDetail);

  it('télécharge le PDF', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`GET ${path(api.IDS.issued, '/pdf')}`]: { pdf: api.PDF_BYTES } });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }));
    await waitFor(() => { expect(callsTo('GET', path(api.IDS.issued, '/pdf'))).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });

  it('traduit l’indisponibilité du service PDF', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`GET ${path(api.IDS.issued, '/pdf')}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }));
    expect(await screen.findByText('Téléchargement impossible')).toBeTruthy();
    expect(screen.getByText('Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans 30 secondes.')).toBeTruthy();
    expect(clicks).not.toHaveBeenCalled();
  });

  it('envoie par e-mail après confirmation', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${path(api.IDS.issued, '/send')}`]: { body: api.sentInvoice } });
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer par e-mail' }));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo('POST', path(api.IDS.issued, '/send'))).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(callsTo('POST', path(api.IDS.issued, '/send'))).toHaveLength(1); });
    expect(await screen.findByText('Envoi demandé')).toBeTruthy();
    expect(screen.getByText(/mise en file d’envoi au contact principal du destinataire.*La remise n’est pas confirmée/)).toBeTruthy();
    expect(screen.queryByText('E-mail envoyé')).toBeNull();
  });

  it('annonce les limites d’envoi et le renvoi permis dans la confirmation', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, api.sentInvoice));
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer par e-mail' }));
    const text = norm((await screen.findByRole('dialog')).textContent);
    expect(text).toContain('mise en file d’envoi');
    expect(text).toContain('Un envoi a déjà été demandé le 16/11/2026 : un nouvel envoi est permis.');
    expect(text).toContain('3 envois par heure pour une même facture, 60 pour l’organisation');
    expect(text).not.toContain('sera envoyée');
  });

  it('présente sent_at comme un envoi demandé, jamais comme une remise', async () => {
    const first = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, api.sentInvoice));
    expect(await screen.findByText('Envoi demandé le 16/11/2026')).toBeTruthy();
    expect(screen.queryByText(/Envoyée par e-mail/)).toBeNull();
    first.unmount();
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, show(api.IDS.issued, api.issuedDetail));
    expect(await screen.findByText('Aucun envoi demandé')).toBeTruthy();
    expect(screen.queryByText(/Pas encore envoyée/)).toBeNull();
  });

  it('explique la limite d’envoi atteinte avec le délai du serveur', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${path(api.IDS.issued, '/send')}`]: { status: 429, body: api.problemSendThrottled, headers: { 'Retry-After': '1800' } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer par e-mail' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Envoi impossible')).toBeTruthy();
    expect(screen.getByText('Limite d’envois atteinte : 3 envois par heure pour une même facture, 60 par heure pour l’organisation. Aucun e-mail n’a été mis en file : réessayez dans 30 minutes.')).toBeTruthy();
  });

  it('indique qu’il manque l’adresse e-mail du destinataire', async () => {
    renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, { ...routes, [`POST ${path(api.IDS.issued, '/send')}`]: { status: 422, body: api.problemRecipientEmailMissing } });
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer par e-mail' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Le destinataire n’a pas d’adresse e-mail principale : ajoutez-en une sur sa fiche avant l’envoi.')).toBeTruthy();
  });

  it('refuse l’accès à une organisation individuelle sans appel', async () => {
    const { callsTo } = renderInvoicing(<InvoiceDetailPage id={api.IDS.issued} />, routes, { kind: 'individual', role: 'owner' });
    expect(await screen.findByText('Facturation indisponible pour ce compte')).toBeTruthy();
    expect(callsTo('GET', path(api.IDS.issued))).toHaveLength(0);
  });
});
