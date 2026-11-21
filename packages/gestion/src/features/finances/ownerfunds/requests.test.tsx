import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import * as fx from './api/requests.fixtures';
import { ownerFundsPaths } from './paths';
import { RequestsPage } from './RequestsPage';
import { ownerFundsUrl, renderOwnerFunds } from './testing';
import type { MockRoute } from './api/testing';

const listUrl = ownerFundsUrl('/payout-account-requests');
const approveUrl = ownerFundsUrl(`/payout-account-requests/${fx.REQUEST_IDS.a}/approve`);
const rejectUrl = ownerFundsUrl(`/payout-account-requests/${fx.REQUEST_IDS.a}/reject`);
const proofUrl = ownerFundsUrl(`/payout-account-requests/${fx.REQUEST_IDS.a}/proof`);
const PROOF_ROUTE = 'POST /auth/reauthenticate/two-factor';
const IBAN = 'FR7630006000011234567890189';
const SLOW = { timeout: 4000 };

const listRoutes = (body: unknown = fx.requestsPending): Record<string, MockRoute> => ({ [`GET ${listUrl}`]: { body } });

async function table() {
  const found = await screen.findByRole('table', { name: 'Demandes de changement d’IBAN' });
  await waitFor(() => { expect(within(found).getAllByText('Awa Diallo').length).toBeGreaterThan(0); }, SLOW);
  return found;
}

async function openApprove() {
  await table();
  await userEvent.click(screen.getByRole('button', { name: 'Approuver la demande de Awa Diallo' }));
  return screen.findByRole('dialog', { name: 'Approuver le changement d’IBAN' });
}

async function fillApprove(dialog: HTMLElement, iban = 'fr76 3000 6000 0112 3456 7890 189', holder = 'Awa Diallo') {
  await userEvent.type(within(dialog).getByLabelText(/IBAN lu sur la pièce/), iban);
  await userEvent.type(within(dialog).getByLabelText(/Titulaire du compte lu sur la pièce/), holder);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approuver le changement' }));
}

const twice = (first: MockRoute, then: MockRoute): MockRoute => {
  let count = 0;
  return (call) => {
    count += 1;
    const route = count === 1 ? first : then;
    return typeof route === 'function' ? route(call) : route;
  };
};

describe('demandes de changement d’IBAN : liste', () => {
  it('affiche les demandes à valider avec le compte masqué, sans IBAN complet', async () => {
    const { container, callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes());

    const rows = within(await table()).getAllByRole('row').slice(1);

    expect(norm(rows[0]?.textContent)).toContain('Awa Diallo');
    expect(norm(rows[0]?.textContent)).toContain('IBAN •••• 7890');
    expect(norm(rows[0]?.textContent)).toContain('À valider');
    expect(norm(rows[1]?.textContent)).toContain('SCI Les Tilleuls');
    expect(callsTo('GET', listUrl)[0]?.search.get('status')).toBe('pending');
    expect(container.textContent).not.toMatch(/FR76|[A-Z]{2}\d{2}[A-Z0-9]{10,}/);
    expect(screen.getByRole('link', { name: 'Changements d’IBAN' }).getAttribute('aria-current')).toBe('page');
    await expectNoA11yViolations(container);
  });

  it('filtre par état et lit le motif d’un refus', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, {
      [`GET ${listUrl}`]: (call) => ({ body: call.search.get('status') === 'rejected' ? fx.requestsRejected : fx.requestsPending }),
    });
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Refusée' }));

    expect(await screen.findByText(/Titulaire de la pièce différent du mandant/)).toBeTruthy();
    expect(callsTo('GET', listUrl).some((call) => call.search.get('status') === 'rejected')).toBe(true);
    expect(screen.getByRole('button', { name: 'Refusée' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: /Approuver la demande/ })).toBeNull();
  });

  it('n’offre aucune action sur une demande qui attend encore le code e-mail', async () => {
    renderOwnerFunds(<RequestsPage />, { [`GET ${listUrl}`]: (call) => ({ body: call.search.get('status') === 'awaiting_code' ? fx.requestsAwaitingCode : fx.requestsPending }) });
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Code e-mail attendu' }));

    expect(await screen.findAllByText('Code e-mail attendu')).not.toHaveLength(0);
    await waitFor(() => { expect(screen.queryByRole('button', { name: /Approuver la demande/ })).toBeNull(); });
    expect(screen.queryByRole('button', { name: /Refuser la demande/ })).toBeNull();
  });

  it('limite la liste au mandant demandé dans l’adresse', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes(), { search: `mandant=${api.IDS.mandantA}` });

    await table();

    expect(callsTo('GET', listUrl)[0]?.search.get('mandant')).toBe(api.IDS.mandantA);
    expect(screen.getByRole('link', { name: 'Voir tous les mandants' }).getAttribute('href')).toBe(ownerFundsPaths.requests);
  });

  it('pagine par curseur', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, { [`GET ${listUrl}`]: (call) => ({ body: call.search.get('cursor') === 'curseur-2' ? fx.requestsRejected : fx.requestsNext }) });
    await table();

    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));

    await waitFor(() => { expect(callsTo('GET', listUrl).some((call) => call.search.get('cursor') === 'curseur-2')).toBe(true); });
  });

  it('affiche l’état vide et l’erreur de chargement sans les confondre', async () => {
    const empty = renderOwnerFunds(<RequestsPage />, listRoutes(fx.requestsEmpty));
    expect(await screen.findByText('Aucune demande à valider pour le moment.')).toBeTruthy();
    empty.unmount();

    renderOwnerFunds(<RequestsPage />, { [`GET ${listUrl}`]: { status: 500, body: { detail: 'Erreur interne.' } } });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Aucune demande à valider pour le moment.')).toBeNull();
  });

  it('laisse un gestionnaire lire sans agir', async () => {
    renderOwnerFunds(<RequestsPage />, listRoutes(), { role: 'manager' });
    await table();

    expect(screen.queryByRole('button', { name: /Approuver|Refuser|Pièce du RIB/ })).toBeNull();
    expect(screen.getByText(/réservé aux rôles propriétaire, administrateur et comptable/)).toBeTruthy();
  });

  it('refuse l’écran à une organisation qui n’est pas une agence', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes(), { kind: 'individual' });

    expect(await screen.findByText('Fonds des mandants indisponibles pour ce compte')).toBeTruthy();
    expect(callsTo('GET', listUrl)).toHaveLength(0);
  });
});

describe('demandes de changement d’IBAN : approbation', () => {
  it('envoie l’IBAN normalisé, le titulaire et la version, sans clé ni IBAN dans l’adresse', async () => {
    const { callsTo, calls } = renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${approveUrl}`]: { body: fx.requestApproved } });
    const dialog = await openApprove();

    await fillApprove(dialog);

    await waitFor(() => { expect(callsTo('POST', approveUrl)).toHaveLength(1); });
    const call = callsTo('POST', approveUrl)[0];
    expect(call?.body).toEqual({ lock_version: 4, iban: IBAN, holder_name: 'Awa Diallo' });
    expect(call?.search.toString()).toBe('');
    expect(call?.headers.get('Idempotency-Key')).toBeNull();
    expect(calls.every((entry) => !entry.path.includes(IBAN) && !entry.search.toString().includes(IBAN))).toBe(true);
    expect(await screen.findByText('Changement approuvé')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(document.body.textContent).not.toContain('FR76');
    expect(callsTo('GET', listUrl).length).toBeGreaterThan(1);
  });

  it('exige les deux saisies avant tout appel', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes());
    const dialog = await openApprove();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Approuver le changement' }));

    expect(await within(dialog).findByText('Saisissez l’IBAN lu sur la pièce du RIB.')).toBeTruthy();
    expect(within(dialog).getByText('Saisissez le titulaire lu sur la pièce du RIB.')).toBeTruthy();
    expect(callsTo('POST', approveUrl)).toHaveLength(0);
  });

  it('refuse localement un IBAN mal formé sans le renvoyer dans un message', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes());
    const dialog = await openApprove();

    await fillApprove(dialog, 'pas un iban');

    const alert = await within(dialog).findByText(/n’a pas la forme attendue/);
    expect(alert.textContent).not.toContain('pas un iban');
    expect(callsTo('POST', approveUrl)).toHaveLength(0);
  });

  it.each([
    ['iban_mismatch', 422, fx.requestProblems.ibanMismatch, /ne correspond pas à celui de la demande/],
    ['holder_mismatch', 422, fx.requestProblems.holderMismatch, /titulaire saisi ne correspond pas/],
    ['validation', 422, fx.requestProblems.validation, /Le titulaire est obligatoire/],
    ['stale', 409, fx.requestProblems.stale, /a changé depuis votre lecture/],
    ['not_actionable', 409, fx.requestProblems.notActionable, /n’est plus en attente de validation/],
    ['self_approval', 409, fx.requestProblems.selfApproval, /Un autre responsable doit la valider/],
    ['contested', 409, fx.requestProblems.contested, /contesté ce changement/],
    ['access_revoked', 409, fx.requestProblems.accessRevoked, /accès du propriétaire.*révoqué/],
    ['not_found', 404, fx.requestProblems.notFound, /n’existe pas dans votre organisation/],
    ['role', 403, fx.requestProblems.role, /Votre rôle ne permet pas cette action/],
    ['rate', 429, { code: 'too_many_requests' }, /Trop de requêtes en peu de temps/],
    ['unavailable', 503, { code: 'service_unavailable' }, /momentanément indisponible/],
  ] as const)('traduit l’erreur %s (%i) et garde la fenêtre ouverte', async (_name, status, body, expected) => {
    renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${approveUrl}`]: { status, body } });
    const dialog = await openApprove();

    await fillApprove(dialog);

    const failure = await within(dialog).findByText(expected);
    expect(failure).toBeTruthy();
    expect(within(dialog).getByText('Changement non approuvé')).toBeTruthy();
    expect(dialog.isConnected).toBe(true);
  });

  it('invite à activer la double authentification sans demander de code', async () => {
    renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${approveUrl}`]: { status: 403, body: fx.requestProblems.twoFactor } });
    const dialog = await openApprove();

    await fillApprove(dialog);

    expect(await within(dialog).findByRole('link', { name: 'Ouvrir Connexion et sécurité' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Confirmez votre identité' })).toBeNull();
  });

  it('redemande un code de double authentification puis rejoue l’approbation avec la même saisie', async () => {
    const { callsTo, container } = renderOwnerFunds(<RequestsPage />, {
      ...listRoutes(),
      [`POST ${approveUrl}`]: twice({ status: 403, body: fx.requestProblems.reauth }, { body: fx.requestApproved }),
      [PROOF_ROUTE]: { status: 204 },
    });
    const dialog = await openApprove();
    await fillApprove(dialog);

    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' });
    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Changement approuvé')).toBeTruthy();
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')[0]?.body).toEqual({ code: '123456' });
    expect(callsTo('POST', approveUrl)).toHaveLength(2);
    expect(callsTo('POST', approveUrl)[1]?.body).toEqual({ lock_version: 4, iban: IBAN, holder_name: 'Awa Diallo' });
    await expectNoA11yViolations(container);
  });

  it('explique pourquoi rien n’est parti quand on renonce à confirmer son identité', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${approveUrl}`]: { status: 403, body: fx.requestProblems.reauth } });
    const dialog = await openApprove();
    await fillApprove(dialog);
    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' });

    await userEvent.click(within(proof).getByRole('button', { name: 'Annuler' }));

    expect(await within(dialog).findByText(/Confirmez votre identité avec un code de double authentification de moins de 10 minutes/)).toBeTruthy();
    expect(callsTo('POST', approveUrl)).toHaveLength(1);
  });

  it('ne conserve pas l’IBAN quand on ferme puis rouvre la fenêtre', async () => {
    renderOwnerFunds(<RequestsPage />, listRoutes());
    const dialog = await openApprove();
    await userEvent.type(within(dialog).getByLabelText(/IBAN lu sur la pièce/), IBAN);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Retour' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    const reopened = await screen.findByRole('button', { name: 'Approuver la demande de Awa Diallo' });
    await userEvent.click(reopened);

    expect(within(await screen.findByRole('dialog')).getByLabelText<HTMLInputElement>(/IBAN lu sur la pièce/).value).toBe('');
  });
});

describe('demandes de changement d’IBAN : refus', () => {
  async function openReject() {
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Refuser la demande de Awa Diallo' }));
    return screen.findByRole('dialog', { name: 'Refuser le changement d’IBAN' });
  }

  it('envoie le motif et la version de la demande', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${rejectUrl}`]: { body: fx.requestRejected } });
    const dialog = await openReject();

    await userEvent.type(within(dialog).getByLabelText(/Motif/), '  Pièce illisible  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));

    expect(await screen.findByText('Demande refusée')).toBeTruthy();
    expect(callsTo('POST', rejectUrl)[0]?.body).toEqual({ lock_version: 4, reason: 'Pièce illisible' });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('exige un motif', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, listRoutes());
    const dialog = await openReject();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));

    expect(await within(dialog).findByText('Indiquez un motif de 3 à 500 caractères.')).toBeTruthy();
    expect(callsTo('POST', rejectUrl)).toHaveLength(0);
  });

  it.each([
    ['stale', 409, fx.requestProblems.stale, /a changé depuis votre lecture/],
    ['not_actionable', 409, fx.requestProblems.notActionable, /n’est plus en attente/],
    ['two_factor', 403, fx.requestProblems.twoFactor, /exige la double authentification/],
    ['rate', 429, { code: 'too_many_requests' }, /Trop de requêtes/],
  ] as const)('traduit l’erreur %s (%i)', async (_name, status, body, expected) => {
    renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`POST ${rejectUrl}`]: { status, body } });
    const dialog = await openReject();
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Pièce illisible');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));

    expect(await within(dialog).findByText(expected)).toBeTruthy();
    expect(within(dialog).getByText('Demande non refusée')).toBeTruthy();
  });

  it('rejoue le refus après confirmation de l’identité', async () => {
    const { callsTo } = renderOwnerFunds(<RequestsPage />, {
      ...listRoutes(),
      [`POST ${rejectUrl}`]: twice({ status: 403, body: fx.requestProblems.reauth }, { body: fx.requestRejected }),
      [PROOF_ROUTE]: { status: 204 },
    });
    const dialog = await openReject();
    await userEvent.type(within(dialog).getByLabelText(/Motif/), 'Pièce illisible');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));
    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' });

    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), 'abcde-12345');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Demande refusée')).toBeTruthy();
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')[0]?.body).toEqual({ recovery_code: 'abcde-12345' });
    expect(callsTo('POST', rejectUrl)).toHaveLength(2);
  });
});

describe('demandes de changement d’IBAN : pièce du RIB', () => {
  const stubDownload = () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:rib');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    return { createObjectURL, names, click };
  };

  it('télécharge la pièce sous un nom neutre, avec l’extension du type reçu', async () => {
    const { createObjectURL, names, click } = stubDownload();
    const { callsTo } = renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`GET ${proofUrl}`]: { file: { type: 'image/png', content: 'PNG' } } });
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Pièce du RIB de Awa Diallo' }));

    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); });
    expect(callsTo('GET', proofUrl)).toHaveLength(1);
    expect(names).toEqual([`justificatif-rib-${fx.REQUEST_IDS.a.slice(0, 8)}.png`]);
    expect(names[0]).not.toMatch(/Awa|Diallo/);
    click.mockRestore();
  });

  it('invite à activer la double authentification quand le serveur refuse', async () => {
    renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`GET ${proofUrl}`]: { status: 403, body: fx.requestProblems.twoFactor } });
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Pièce du RIB de Awa Diallo' }));

    expect(await screen.findByText('Pièce non téléchargée')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ouvrir Connexion et sécurité' })).toBeTruthy();
  });

  it('refuse un contenu qui n’est ni un PDF ni une image', async () => {
    renderOwnerFunds(<RequestsPage />, { ...listRoutes(), [`GET ${proofUrl}`]: { file: { type: 'text/html', content: '<p>x</p>' } } });
    await table();

    await userEvent.click(screen.getByRole('button', { name: 'Pièce du RIB de Awa Diallo' }));

    expect(await screen.findByText(/Réponse inattendue du serveur/)).toBeTruthy();
  });

  it('rejoue le téléchargement après confirmation de l’identité', async () => {
    const { createObjectURL, click } = stubDownload();
    const { callsTo } = renderOwnerFunds(<RequestsPage />, {
      ...listRoutes(),
      [`GET ${proofUrl}`]: twice({ status: 403, body: fx.requestProblems.reauth }, { file: { type: 'application/pdf', content: '%PDF' } }),
      [PROOF_ROUTE]: { status: 204 },
    });
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Pièce du RIB de Awa Diallo' }));
    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' });

    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); });
    expect(callsTo('GET', proofUrl)).toHaveLength(2);
    click.mockRestore();
  });
});
