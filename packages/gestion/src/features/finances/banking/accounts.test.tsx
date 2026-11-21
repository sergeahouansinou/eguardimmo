import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import { AccountsPage } from './AccountsPage';
import * as api from './api/responses.fixtures';
import { PROOF_ROUTE, bankingUrl, problem, renderBanking, twice } from './testing';

const SLOW = { timeout: 4000 };
const accountsUrl = bankingUrl('/accounts');
const IBAN = 'FR76 3000 6000 0112 3456 7890 189';

function fillCreateForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/^Nom du compte/), { target: { value: 'Compte courant agence' } });
  fireEvent.change(within(dialog).getByLabelText(/^Titulaire/), { target: { value: 'Agence Dupont Immobilier' } });
  fireEvent.change(within(dialog).getByLabelText(/^IBAN ou numéro de compte/), { target: { value: IBAN } });
  fireEvent.change(within(dialog).getByLabelText(/^Solde d’ouverture/), { target: { value: '1250,50' } });
  fireEvent.change(within(dialog).getByLabelText(/^Suivi à partir du/), { target: { value: '2026-01-01' } });
}

describe('comptes bancaires : accès et lecture', () => {
  it('refuse le gestionnaire sans appeler la banque', async () => {
    const { calls } = renderBanking(<AccountsPage />, {}, { role: 'manager' });
    expect(await screen.findByText('Banque indisponible pour ce compte', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('montre les quatre derniers caractères seulement, jamais l’IBAN complet', async () => {
    const { container } = renderBanking(<AccountsPage />, {}, { role: 'owner' });
    expect(await screen.findByText('Compte courant agence', {}, SLOW)).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('••••0189');
    expect(text).not.toContain('FR76');
    expect(text).toContain('Compte de tiers');
    await expectNoA11yViolations(container);
  });

  it('le comptable consulte sans pouvoir ajouter, modifier, remplacer ni fermer', async () => {
    renderBanking(<AccountsPage />, {}, { role: 'accountant' });
    await screen.findByText('Compte courant agence', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Ajouter un compte' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Modifier / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remplacer / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Fermer / })).toBeNull();
  });

  it('affiche l’état vide et l’erreur de chargement', async () => {
    renderBanking(<AccountsPage />, { [`GET ${accountsUrl}`]: { body: { data: [] } } }, { role: 'owner' });
    expect(await screen.findByText(/Aucun compte suivi/, {}, SLOW)).toBeTruthy();
  });

  it('traduit une panne serveur', async () => {
    renderBanking(<AccountsPage />, { [`GET ${accountsUrl}`]: problem(503, 'unavailable') }, { role: 'owner' });
    expect(await screen.findByText(/momentanément indisponible/, {}, SLOW)).toBeTruthy();
  });
});

describe('comptes bancaires : création', () => {
  it('crée un compte avec la preuve 2FA puis rejoue avec la même clé d’idempotence', async () => {
    const { callsTo } = renderBanking(<AccountsPage />, {
      [`POST ${accountsUrl}`]: twice(problem(403, 'reauthentication_required'), { status: 201, body: { data: api.account } }),
      [PROOF_ROUTE]: { status: 204 },
    }, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Nouveau compte bancaire' });
    fillCreateForm(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le compte' }));

    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => { expect(callsTo('POST', accountsUrl)).toHaveLength(2); }, SLOW);
    const [first, second] = callsTo('POST', accountsUrl);
    expect(first?.body).toMatchObject({ ledger_role: 'bank', label: 'Compte courant agence', identifier: 'FR7630006000011234567890189', opening_bank_balance: 125050, reconciliation_from: '2026-01-01' });
    expect(second?.headers.get('Idempotency-Key')).toBe(first?.headers.get('Idempotency-Key'));
    expect(first?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('valide le formulaire sans appel quand des champs manquent', async () => {
    const { callsTo } = renderBanking(<AccountsPage />, {}, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Nouveau compte bancaire' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le compte' }));
    expect(await within(dialog).findByText('Donnez un nom au compte.', {}, SLOW)).toBeTruthy();
    expect(within(dialog).getByText('Indiquez le titulaire du compte.')).toBeTruthy();
    expect(callsTo('POST', accountsUrl)).toHaveLength(0);
  });

  it('sans 2FA activée, renvoie vers la sécurité du compte', async () => {
    renderBanking(<AccountsPage />, { [`POST ${accountsUrl}`]: problem(403, 'two_factor_required') }, { role: 'admin' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Nouveau compte bancaire' });
    fillCreateForm(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le compte' }));
    const link = await within(dialog).findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW);
    expect(link.getAttribute('href')).toBe('/compte/securite');
  });

  it.each([
    ['rôle déjà pris', problem(409, 'bank_account_role_taken'), /déjà suivi/],
    ['IBAN invalide', problem(422, 'bank_account_identifier_invalid'), /relisez l’IBAN/],
    ['429', problem(429, 'throttled'), /Trop de requêtes/],
  ])('traduit l’erreur %s', async (_name, reply, expected) => {
    renderBanking(<AccountsPage />, { [`POST ${accountsUrl}`]: reply }, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Nouveau compte bancaire' });
    fillCreateForm(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le compte' }));
    expect(await within(dialog).findByText(expected, {}, SLOW)).toBeTruthy();
  });
});

describe('comptes bancaires : modification, remplacement, fermeture', () => {
  it('renvoie toujours le profil CSV courant en modifiant le nom', async () => {
    const url = bankingUrl(`/accounts/${api.IDS.account}`);
    const { callsTo } = renderBanking(<AccountsPage />, { [`PATCH ${url}`]: { body: { data: { ...api.account, label: 'Compte principal' } } } }, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier Compte courant agence' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier le compte' });
    fireEvent.change(within(dialog).getByLabelText(/^Nom du compte/), { target: { value: 'Compte principal' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(callsTo('PATCH', url)).toHaveLength(1); }, SLOW);
    expect(callsTo('PATCH', url)[0]?.body).toMatchObject({ label: 'Compte principal', csv_profile: { delimiter: ';', date_format: 'd/m/Y', decimal_separator: ',', columns: { booking_date: 1, label: 2, amount: 3 } } });
  });

  it('remplace un compte avec le même rôle de grand livre et une nouvelle clé', async () => {
    const url = bankingUrl(`/accounts/${api.IDS.account}/replace`);
    const { callsTo } = renderBanking(<AccountsPage />, { [`POST ${url}`]: { status: 201, body: { data: { ...api.account, id: api.IDS.accountTrust } } } }, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Remplacer Compte courant agence' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Remplacer le compte' });
    expect(within(dialog).getByLabelText<HTMLInputElement>(/^Nom du compte/).value).toBe('Compte courant agence');
    fireEvent.change(within(dialog).getByLabelText(/^IBAN ou numéro de compte/), { target: { value: IBAN } });
    fireEvent.change(within(dialog).getByLabelText(/^Solde d’ouverture/), { target: { value: '0' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remplacer le compte' }));
    await waitFor(() => { expect(callsTo('POST', url)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', url)[0]?.body).toMatchObject({ identifier: 'FR7630006000011234567890189', opening_bank_balance: 0 });
    expect(callsTo('POST', url)[0]?.body).not.toHaveProperty('ledger_role');
  });

  it('ferme un compte après confirmation', async () => {
    const url = bankingUrl(`/accounts/${api.IDS.account}/close`);
    const { callsTo } = renderBanking(<AccountsPage />, { [`POST ${url}`]: { body: { data: api.accountClosed } } }, { role: 'owner' });
    await userEvent.click(await screen.findByRole('button', { name: 'Fermer Compte courant agence' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Fermer ce compte ?' });
    expect(callsTo('POST', url)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fermer le compte' }));
    await waitFor(() => { expect(callsTo('POST', url)).toHaveLength(1); }, SLOW);
  });

  it('n’offre ni modification ni fermeture sur un compte fermé', async () => {
    renderBanking(<AccountsPage />, { [`GET ${accountsUrl}`]: { body: { data: [api.accountClosed] } } }, { role: 'owner' });
    await screen.findByText('Ancien compte', {}, SLOW);
    expect(screen.queryByRole('button', { name: /^Fermer / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Modifier / })).toBeNull();
    expect(norm(document.body.textContent)).toContain('Fermé');
  });
});
