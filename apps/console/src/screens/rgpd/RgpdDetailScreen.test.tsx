import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { approvalData, problem, proofInvalid, proofRequired } from '@/platform/fixtures';
import { PRIVACY_IDS, detailData, erasureData, requestData } from '@/platform/privacy/privacyFixtures';
import { consolePath, operatorLoaded, withOperator } from '../abonnements/testSupport';
import { RgpdDetailScreen } from './RgpdDetailScreen';

const ERASURE = 'privacy.erasure.execute';
const base = (id: string) => `/privacy-requests/${id}`;
const isVerb = (request: RecordedRequest, id: string, verb: string) => request.method === 'POST' && consolePath(request) === `${base(id)}/${verb}`;
const isApprovalRequest = (request: RecordedRequest) => request.method === 'POST' && consolePath(request) === '/approvals';
const received = [{ kind: 'received', occurred_at: '2026-11-10T09:00:00+00:00', actor_id: PRIVACY_IDS.account }];

interface Setup {
  id?: string;
  roles?: string[];
  detail?: Record<string, unknown>;
  get?: (request: RecordedRequest) => Response | undefined;
  write?: (request: RecordedRequest) => Response | undefined;
  pending?: Record<string, unknown>[];
}

function mount({ id = PRIVACY_IDS.request, roles = ['compliance'], detail = detailData({ events: received }), get, write, pending }: Setup = {}) {
  return renderPlatform(
    <RgpdDetailScreen id={id} />,
    withOperator({ roles, pending }, (request) => {
      if (request.method === 'GET' && consolePath(request) === base(id)) return get?.(request) ?? json(200, { data: detail });
      return write?.(request);
    }),
  );
}

type User = ReturnType<typeof userEvent.setup>;
const enterCode = async (user: User, code: string) => {
  await user.type(await screen.findByLabelText('Code de double authentification'), code);
  await user.click(screen.getByRole('button', { name: 'Confirmer' }));
};
const press = async (user: User, name: string) => {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog');
};

describe('écran d’une demande RGPD', () => {
  it('affiche le demandeur, les délais, la conformité et le journal de preuve, sans lien de téléchargement', async () => {
    const view = mount({ detail: detailData() });

    expect(await screen.findByRole('heading', { name: 'Accès, Léa Fontaine' })).toBeTruthy();
    expect(screen.getByText('lea.fontaine@exemple.fr')).toBeTruthy();
    expect(screen.getByText('Demande reçue')).toBeTruthy();
    expect(screen.getByText('Identité vérifiée')).toBeTruthy();
    expect(screen.getByText('L’export n’est jamais téléchargeable depuis la console : seul le demandeur y accède.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /télécharg/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /télécharg/i })).toBeNull();
    await expectNoA11yViolations(view.container);
  });

  it('indique l’absence de journal quand le serveur n’en fournit pas', async () => {
    mount({ detail: requestData() });

    expect(await screen.findByText('Aucun événement enregistré.')).toBeTruthy();
  });

  it('signale une demande en retard et une prolongation avec son motif', async () => {
    mount({ detail: detailData({ overdue: true, extended_until: '2027-01-10T09:00:00+00:00', extension_reason: 'complexity' }) });

    expect(await screen.findAllByText('En retard')).not.toHaveLength(0);
    expect(screen.getByText(/Jusqu’au .*Complexité de la demande/)).toBeTruthy();
  });

  it('ne propose aucune action sur une demande close', async () => {
    mount({ detail: detailData({ status: 'completed', completed_at: '2026-11-12T09:00:00+00:00' }) });

    expect(await screen.findByText('Cette demande est close : aucune action n’est plus possible.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clôturer la demande' })).toBeNull();
  });

  it('ne propose aucune action à un rôle autre que conformité', async () => {
    const view = mount({ roles: ['admin'] });
    await screen.findByRole('heading', { name: 'Accès, Léa Fontaine' });
    await operatorLoaded(view.requests);

    expect(screen.getByText('Seul le rôle Conformité peut traiter cette demande.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vérifier l’identité' })).toBeNull();
  });

  describe('vérification d’identité', () => {
    it('vérifie l’identité avec la preuve 2FA : 422 operator_proof_required, code, rejeu, succès', async () => {
      let verified = false;
      const view = mount({
        get: () => json(200, { data: verified ? detailData({ identity_verified_by: 'video_call', identity_verified_at: '2026-11-11T09:00:00+00:00' }) : detailData({ events: received }) }),
        write: (request) => {
          if (!isVerb(request, PRIVACY_IDS.request, 'verify')) return undefined;
          if (request.body?.two_factor_code !== '123456') return json(422, proofRequired);
          verified = true;
          return json(200, { data: detailData({ identity_verified_by: 'video_call', identity_verified_at: '2026-11-11T09:00:00+00:00' }) });
        },
      });
      const user = userEvent.setup();
      const dialog = await press(user, 'Vérifier l’identité');
      await user.click(within(dialog).getByRole('radio', { name: 'Appel vidéo' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmer la vérification' }));
      await enterCode(user, '123456');

      expect((await screen.findAllByText('Identité vérifiée')).length).toBeGreaterThan(0);
      expect(view.writes().map((request) => request.body)).toEqual([{ verification_method: 'video_call' }, { verification_method: 'video_call', two_factor_code: '123456' }]);
      await waitFor(() => { expect(screen.queryByRole('button', { name: 'Vérifier l’identité' })).toBeNull(); });
      expect(JSON.stringify(view.requests.filter((request) => request.method === 'GET'))).not.toContain('123456');
    });

    it('redemande un code refusé (operator_proof_invalid) puis aboutit', async () => {
      const view = mount({
        write: (request) => {
          if (!isVerb(request, PRIVACY_IDS.request, 'verify')) return undefined;
          const code = request.body?.two_factor_code;
          if (code === undefined) return json(422, proofRequired);
          return code === '654321' ? json(200, { data: detailData() }) : json(422, proofInvalid);
        },
      });
      const user = userEvent.setup();
      const dialog = await press(user, 'Vérifier l’identité');
      await user.click(within(dialog).getByRole('radio', { name: 'Canal déjà connu' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmer la vérification' }));
      await enterCode(user, '000000');
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await user.type(screen.getByLabelText('Code de double authentification'), '654321');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      await waitFor(() => { expect(view.writes().map((request) => request.body?.two_factor_code)).toEqual([undefined, '000000', '654321']); });
      await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    });

    it('n’exécute rien quand on annule la saisie du code et garde la boîte ouverte avec l’erreur', async () => {
      const view = mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'verify') ? json(422, proofRequired) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Vérifier l’identité');
      await user.click(within(dialog).getByRole('radio', { name: 'Appel vidéo' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmer la vérification' }));
      await screen.findByLabelText('Code de double authentification');
      await user.click(within(screen.getByRole('dialog', { name: 'Confirmer avec votre code' })).getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByText(proofRequired.detail)).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
    });

    it('exige un choix de méthode avant tout envoi', async () => {
      const view = mount();
      const user = userEvent.setup();
      const dialog = await press(user, 'Vérifier l’identité');
      await user.click(within(dialog).getByRole('button', { name: 'Confirmer la vérification' }));

      expect(await within(dialog).findByText('Faites un choix pour continuer.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('affiche le refus 409 d’une demande close', async () => {
      mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'verify') ? json(409, problem(409, 'privacy_request_closed', 'Cette demande est déjà close.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Vérifier l’identité');
      await user.click(within(dialog).getByRole('radio', { name: 'Appel vidéo' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmer la vérification' }));

      expect(await within(dialog).findByText('Cette demande est déjà close.')).toBeTruthy();
    });
  });

  describe('prolongation, transmission, clôture et refus', () => {
    it('prolonge le délai avec le motif choisi et masque l’action une fois prolongé', async () => {
      const view = mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'extend') ? json(200, { data: detailData() }) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Prolonger le délai');
      await user.click(within(dialog).getByRole('radio', { name: 'Complexité de la demande' }));
      await user.click(within(dialog).getByRole('button', { name: 'Prolonger le délai' }));

      await waitFor(() => { expect(view.writes()[0]?.body).toEqual({ reason: 'complexity' }); });
    });

    it('n’offre pas la prolongation quand elle a déjà eu lieu', async () => {
      mount({ detail: detailData({ extended_until: '2027-01-10T09:00:00+00:00', extension_reason: 'volume' }) });

      expect(await screen.findByRole('button', { name: 'Clôturer la demande' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Prolonger le délai' })).toBeNull();
    });

    it('affiche le refus 409 privacy_already_extended', async () => {
      mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'extend') ? json(409, problem(409, 'privacy_already_extended', 'Le délai a déjà été prolongé une fois.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Prolonger le délai');
      await user.click(within(dialog).getByRole('radio', { name: 'Nombre de demandes' }));
      await user.click(within(dialog).getByRole('button', { name: 'Prolonger le délai' }));

      expect(await within(dialog).findByText('Le délai a déjà été prolongé une fois.')).toBeTruthy();
    });

    it('transmet aux organisations et annonce le nombre de transmissions du serveur', async () => {
      const view = mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'forward') ? json(200, { data: detailData({ forwards: { total: 2, handled: 0 } }), meta: { forwarded: 2 } }) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Transmettre aux organisations');
      await user.click(within(dialog).getByRole('button', { name: 'Transmettre' }));

      expect(await screen.findByText('2 transmission(s) envoyée(s).')).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
    });

    it('affiche le refus de transmission tant que l’identité n’est pas vérifiée', async () => {
      mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'forward') ? json(422, problem(422, 'privacy_identity_not_verified', 'Vérifiez l’identité du demandeur avant de transmettre.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Transmettre aux organisations');
      await user.click(within(dialog).getByRole('button', { name: 'Transmettre' }));

      expect(await within(dialog).findByText('Vérifiez l’identité du demandeur avant de transmettre.')).toBeTruthy();
    });

    it('clôture la demande après confirmation', async () => {
      const view = mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'complete') ? json(200, { data: detailData({ status: 'completed' }) }) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Clôturer la demande');
      expect(view.writes()).toHaveLength(0);
      await user.click(within(dialog).getByRole('button', { name: 'Clôturer la demande' }));

      expect(await screen.findByText('Demande clôturée')).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
    });

    it('refuse la demande avec le motif choisi', async () => {
      let refused = false;
      const view = mount({
        get: () => json(200, { data: refused ? detailData({ status: 'refused', refusal_reason: 'excessive' }) : detailData() }),
        write: (request) => {
          if (!isVerb(request, PRIVACY_IDS.request, 'refuse')) return undefined;
          refused = true;
          return json(200, { data: detailData({ status: 'refused', refusal_reason: 'excessive' }) });
        },
      });
      const user = userEvent.setup();
      const dialog = await press(user, 'Refuser la demande');
      await user.click(within(dialog).getByRole('radio', { name: 'Excessive' }));
      await user.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));

      await waitFor(() => { expect(view.writes()[0]?.body).toEqual({ reason: 'excessive' }); });
      expect(await screen.findByText('Cette demande est close : aucune action n’est plus possible.')).toBeTruthy();
    });

    it('affiche le refus 429 d’une écriture', async () => {
      mount({ write: (request) => (isVerb(request, PRIVACY_IDS.request, 'complete') ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '8' }) : undefined) });
      const user = userEvent.setup();
      const dialog = await press(user, 'Clôturer la demande');
      await user.click(within(dialog).getByRole('button', { name: 'Clôturer la demande' }));

      expect(await within(dialog).findByText(/Réessayez dans 8 s/)).toBeTruthy();
    });
  });

  describe('effacement du compte par double validation', () => {
    const erasure = () => erasureData();
    const openDialog = async (user: User) => press(user, 'Demander l’effacement du compte');

    it('ne propose l’effacement que pour une demande d’effacement liée à un compte', async () => {
      mount({ detail: detailData() });
      await screen.findByRole('button', { name: 'Clôturer la demande' });

      expect(screen.queryByRole('button', { name: 'Demander l’effacement du compte' })).toBeNull();
    });

    it('ne propose pas l’effacement d’un demandeur sans compte', async () => {
      mount({ id: PRIVACY_IDS.second, detail: erasureData({ requester: { account_id: null, name: null, email: 'claire.martin@exemple.fr' } }) });
      await screen.findByRole('button', { name: 'Clôturer la demande' });

      expect(screen.queryByRole('button', { name: 'Demander l’effacement du compte' })).toBeNull();
    });

    it('exige la case d’irréversibilité avant tout envoi', async () => {
      const view = mount({ id: PRIVACY_IDS.second, detail: erasure() });
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.type(within(dialog).getByLabelText('Motif'), 'Demande de la personne vérifiée par visioconférence.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander l’effacement' }));

      expect(await within(dialog).findByText('Confirmez que vous avez compris le caractère irréversible.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('dépose la demande avec pour sujet l’identifiant de la demande RGPD, après la preuve 2FA', async () => {
      const view = mount({
        id: PRIVACY_IDS.second,
        detail: erasure(),
        write: (request) => {
          if (!isApprovalRequest(request)) return undefined;
          return request.body?.two_factor_code === '123456' ? json(201, { data: approvalData({ action: ERASURE, subject: { type: 'privacy_request', id: PRIVACY_IDS.second } }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole('checkbox', { name: 'Je comprends que l’effacement du compte est irréversible.' }));
      await user.type(within(dialog).getByLabelText('Motif'), 'Demande de la personne vérifiée par visioconférence.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander l’effacement' }));
      await enterCode(user, '123456');

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      const reason = 'Demande de la personne vérifiée par visioconférence.';
      expect(view.writes().map((request) => request.body)).toEqual([
        { action: ERASURE, subject_id: PRIVACY_IDS.second, reason },
        { action: ERASURE, subject_id: PRIVACY_IDS.second, reason, two_factor_code: '123456' },
      ]);
    });

    it('affiche la demande en attente et retire le bouton', async () => {
      mount({ id: PRIVACY_IDS.second, detail: erasure(), pending: [approvalData({ action: ERASURE, subject: { type: 'privacy_request', id: PRIVACY_IDS.second } })] });

      expect(await screen.findByText('Effacement en attente d’un second opérateur')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Voir les approbations' }).getAttribute('href')).toBe('/approbations');
      expect(screen.queryByRole('button', { name: 'Demander l’effacement du compte' })).toBeNull();
    });

    it('affiche le refus 422 privacy_erasure_requires_approval du serveur', async () => {
      mount({ id: PRIVACY_IDS.second, detail: erasure(), write: (request) => (isApprovalRequest(request) ? json(422, problem(422, 'privacy_identity_not_verified', 'Vérifiez l’identité avant de demander l’effacement.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole('checkbox', { name: 'Je comprends que l’effacement du compte est irréversible.' }));
      await user.type(within(dialog).getByLabelText('Motif'), 'Demande de la personne vérifiée par visioconférence.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander l’effacement' }));

      expect(await within(dialog).findByText('Vérifiez l’identité avant de demander l’effacement.')).toBeTruthy();
      await expectNoA11yViolations(dialog);
    });
  });

  describe('erreurs de chargement', () => {
    it('affiche « Demande introuvable » sur un 404', async () => {
      mount({ get: () => json(404, problem(404, 'privacy_request_not_found', 'Cette demande n’existe pas.')) });

      expect(await screen.findByText('Demande introuvable')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Retour au registre' }).getAttribute('href')).toBe('/rgpd');
    });

    it.each([
      [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
      [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    ])('affiche l’erreur %i du serveur', async (status, body, title) => {
      mount({ get: () => json(status, body, status === 429 ? { 'Retry-After': '8' } : {}) });

      expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
    });

    it('recharge par « Réessayer »', async () => {
      let calls = 0;
      mount({ get: () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.')) : json(200, { data: detailData() })) });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByRole('heading', { name: 'Accès, Léa Fontaine' })).toBeTruthy();
    });
  });
});
