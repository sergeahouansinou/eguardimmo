import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { useTwoFactorProof } from '../../reauth';
import { errorMessage } from '../kit';
import type { ApiLocatairesSource } from './apiSource';
import * as api from './responses.fixtures';
import { party, setup } from './testing';
import type { MockRoute } from './testing';

const bankPath = `${party(api.IDS.awa)}/bank-accounts`;
const replacementPath = `${bankPath}/${api.IDS.bank}/replacement`;
const PROOF = 'POST /auth/reauthenticate/two-factor';
const IBAN = 'FR7630006000011234567890189';

function Harness({ source, replace = false }: { source: ApiLocatairesSource; replace?: boolean }) {
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const [message, setMessage] = useState('');
  const run = (): void => {
    const call = replace ? source.replaceBankAccount(api.IDS.awa, api.IDS.bank, { iban: IBAN, holderName: 'Awa Diallo' }) : source.addBankAccount(api.IDS.awa, { iban: IBAN, holderName: 'Awa Diallo' });
    call.then(
      (account) => { setMessage(`Compte enregistré •••• ${account.ibanLast4}`); },
      (error: unknown) => {
        if (proof.intercept(error, run)) return;
        setMessage(errorMessage(error));
      },
    );
  };
  return (
    <>
      <button type="button" onClick={run}>Enregistrer le compte</button>
      <p role="status">{message}</p>
      {proof.dialog}
    </>
  );
}

const problem = (status: number, code: string, detail: string) => ({ status, body: api.problem(status, code, detail, detail) });

function twice(first: MockRoute): MockRoute {
  let count = 0;
  return (call) => {
    count += 1;
    if (count === 1) return typeof first === 'function' ? first(call) : first;
    return { status: 201, body: { data: api.bankAccount } };
  };
}

describe('compte bancaire d’une partie : preuve 2FA et erreurs', () => {
  it('enregistre le compte quand le serveur l’accepte, sans demander de code', async () => {
    const { source, callsTo } = setup({ [`POST ${bankPath}`]: { status: 201, body: { data: api.bankAccount } } });
    render(<Harness source={source} />);

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));

    expect(await screen.findByText('Compte enregistré •••• 0189')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')).toHaveLength(0);
  });

  it('redemande le code sur reauthentication_required puis rejoue l’ajout', async () => {
    const { source, callsTo } = setup({
      [`POST ${bankPath}`]: twice(problem(403, 'reauthentication_required', 'Confirmation récente requise.')),
      [PROOF]: { status: 204 },
    });
    const { container } = render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));

    const dialog = await screen.findByRole('dialog', { name: 'Confirmez votre identité' });
    await userEvent.type(screen.getByLabelText(/Code de double authentification/), '123 456');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Compte enregistré •••• 0189')).toBeTruthy();
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')[0]?.body).toEqual({ code: '123456' });
    expect(callsTo('POST', bankPath)).toHaveLength(2);
    expect(callsTo('POST', bankPath)[1]?.body).toEqual({ iban: IBAN, holder_name: 'Awa Diallo' });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(dialog.isConnected).toBe(false);
    await expectNoA11yViolations(container);
  });

  it('rejoue aussi le remplacement d’un compte', async () => {
    const { source, callsTo } = setup({
      [`POST ${replacementPath}`]: twice(problem(403, 'reauthentication_required', 'Confirmation récente requise.')),
      [PROOF]: { status: 204 },
    });
    render(<Harness source={source} replace />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await userEvent.type(await screen.findByLabelText(/Code de double authentification/), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Compte enregistré •••• 0189')).toBeTruthy();
    expect(callsTo('POST', replacementPath)).toHaveLength(2);
  });

  it('envoie un code de secours sous recovery_code', async () => {
    const { source, callsTo } = setup({
      [`POST ${bankPath}`]: twice(problem(403, 'reauthentication_required', 'Confirmation récente requise.')),
      [PROOF]: { status: 204 },
    });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await userEvent.type(await screen.findByLabelText(/Code de double authentification/), 'abcde-12345');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await screen.findByText('Compte enregistré •••• 0189');
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')[0]?.body).toEqual({ recovery_code: 'abcde-12345' });
  });

  it('garde la fenêtre ouverte sur un code refusé et ne rejoue rien', async () => {
    const { source, callsTo } = setup({
      [`POST ${bankPath}`]: problem(403, 'reauthentication_required', 'Confirmation récente requise.'),
      [PROOF]: { status: 422, body: { code: 'validation_failed', errors: { code: ['Code invalide.'] } } },
    });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await userEvent.type(await screen.findByLabelText(/Code de double authentification/), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Ce code est incorrect ou expiré. Vérifiez-le puis réessayez.')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Confirmez votre identité' })).toBeTruthy();
    expect(callsTo('POST', bankPath)).toHaveLength(1);
  });

  it('annonce un trop grand nombre d’essais sur 429', async () => {
    const { source } = setup({
      [`POST ${bankPath}`]: problem(403, 'reauthentication_required', 'Confirmation récente requise.'),
      [PROOF]: { status: 429, body: { code: 'too_many_attempts' } },
    });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await userEvent.type(await screen.findByLabelText(/Code de double authentification/), '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText(/Trop d’essais en peu de temps/)).toBeTruthy();
  });

  it('abandonne sans rejouer quand on annule', async () => {
    const { source, callsTo } = setup({ [`POST ${bankPath}`]: problem(403, 'reauthentication_required', 'Confirmation récente requise.') });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(callsTo('POST', bankPath)).toHaveLength(1);
    expect(callsTo('POST', '/auth/reauthenticate/two-factor')).toHaveLength(0);
  });

  it('invite à activer la 2FA sur two_factor_required, sans fenêtre de code', async () => {
    const { source } = setup({ [`POST ${bankPath}`]: problem(403, 'two_factor_required', 'Activez la double authentification.') });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));

    expect(await screen.findByText(/Activez-la dans Mon compte, Connexion et sécurité/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renvoie le mandant vers sa demande d’IBAN sur owner_access_requires_payout_request', async () => {
    const { source } = setup({ [`POST ${bankPath}`]: problem(409, 'owner_access_requires_payout_request', 'Accès propriétaire actif.') });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));

    expect(await screen.findByText(/Ce mandant change son compte de paiement depuis son espace propriétaire/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('demandes de changement d’IBAN');
  });

  it.each([
    [403, 'role_forbidden', 'Vous n’avez pas le droit d’effectuer cette action sur les locataires.'],
    [404, 'party_not_found', 'Cette fiche n’existe pas.'],
    [429, 'too_many_requests', 'Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée'],
    [503, 'service_unavailable', 'Le service est momentanément indisponible. Rien n’a été enregistré'],
  ] as const)('traduit %i (%s) en français, sans ouvrir de fenêtre de code', async (status, code, expected) => {
    const { source } = setup({ [`POST ${bankPath}`]: problem(status, code, 'Cette fiche n’existe pas.') });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));

    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain(expected); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ne place jamais l’IBAN dans une adresse', async () => {
    const { source, calls } = setup({ [`POST ${bankPath}`]: { status: 201, body: { data: api.bankAccount } } });
    render(<Harness source={source} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le compte' }));
    await screen.findByText('Compte enregistré •••• 0189');

    expect(calls.every((call) => !call.path.includes(IBAN) && call.search.toString() === '')).toBe(true);
  });
});
