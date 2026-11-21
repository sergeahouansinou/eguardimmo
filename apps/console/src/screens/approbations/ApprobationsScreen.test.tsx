import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { IDS, approvalData, approvalList, meData, problem, proofInvalid, proofRequired } from '@/platform/fixtures';
import { ApprobationsScreen } from './ApprobationsScreen';

const APPROVAL_PATH = `/api/v1/console/approvals/${IDS.approval}`;
const isDecision = (request: RecordedRequest, verb: string) => request.method === 'POST' && request.url.pathname === `${APPROVAL_PATH}/${verb}`;

interface Setup {
  rows?: Record<string, unknown>[];
  meta?: Record<string, unknown>;
  list?: (request: RecordedRequest) => Response | undefined;
  decide?: (request: RecordedRequest) => Response | undefined;
  roles?: string[];
}

function mount({ rows = [approvalData()], meta, list, decide, roles }: Setup = {}) {
  return renderPlatform(<ApprobationsScreen />, (request) => {
    const { pathname } = request.url;
    if (pathname === '/api/v1/console/me') return json(200, meData(roles));
    if (pathname === '/api/v1/console/approvals' && request.method === 'GET') return list?.(request) ?? json(200, approvalList(rows, meta));
    if (request.method === 'POST') return decide?.(request);
    return undefined;
  });
}

const openDetail = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Ouvrir/ }));
  return screen.findByRole('dialog');
};

describe('écran des approbations', () => {
  it('liste les demandes en attente avec le compteur du serveur et sans erreur d’accessibilité', async () => {
    const view = mount({ rows: [approvalData(), approvalData({ id: IDS.request, action: 'identity.account.reset_two_factor', subject: { type: 'user', id: IDS.user } })], meta: { pending_count: 2 } });

    expect(await screen.findByText('2 demandes attendent une validation.')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Demandes d’approbation' })).toBeTruthy();
    expect(view.requests.find((request) => request.url.pathname === '/api/v1/console/approvals')?.url.searchParams.get('status')).toBe('pending');
    await expectNoA11yViolations(view.container);
  });

  it('affiche l’état vide quand aucune demande ne correspond', async () => {
    mount({ rows: [], meta: { pending_count: 0 } });

    expect(await screen.findByText('Aucune demande ne correspond')).toBeTruthy();
  });

  it('transmet les filtres au serveur et revient à la première page', async () => {
    const view = mount({ meta: { has_more: true, next_cursor: 'curseur-2' } });
    const user = userEvent.setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => { expect(view.requests.some((request) => request.url.searchParams.get('cursor') === 'curseur-2')).toBe(true); });
    await user.click(screen.getByLabelText('Mes demandes'));

    await waitFor(() => {
      const last = view.requests.filter((request) => request.url.pathname === '/api/v1/console/approvals').at(-1);
      expect(last?.url.searchParams.get('mine')).toBe('1');
      expect(last?.url.searchParams.has('cursor')).toBe(false);
    });
  });

  it.each([
    [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
    [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    [500, problem(500, 'server_error', 'Erreur interne.'), 'Les approbations n’a pas pu être chargé'],
  ])('affiche l’erreur %i du serveur', async (status, body, title) => {
    mount({ list: () => json(status, body, status === 429 ? { 'Retry-After': '8' } : {}) });

    expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
    if (status === 429) expect(screen.getByText(/Réessayez dans 8 s/)).toBeTruthy();
  });

  it('recharge la liste par « Réessayer » après une panne', async () => {
    let calls = 0;
    mount({ list: () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.')) : json(200, approvalList([approvalData()]))) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table')).toBeTruthy();
  });

  describe('décision d’un second opérateur', () => {
    it('valide avec la preuve 2FA : 422 operator_proof_required, modale, rejeu avec le code, succès', async () => {
      let attempts = 0;
      const view = mount({
        decide: (request) => {
          if (!isDecision(request, 'approve')) return undefined;
          attempts += 1;
          return request.body?.two_factor_code === '123456' ? json(200, { data: approvalData({ status: 'approved', permissions: { can_decide: false, can_cancel: false } }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      const detail = await openDetail(user);
      await user.click(within(detail).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));
      await user.type(await screen.findByLabelText('Code de double authentification'), '123456');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande validée')).toBeTruthy();
      expect(attempts).toBe(2);
      const writes = view.writes().filter((request) => isDecision(request, 'approve'));
      expect(writes.map((request) => request.body)).toEqual([null, { two_factor_code: '123456' }]);
      expect(JSON.stringify(view.requests.filter((request) => request.method === 'GET'))).not.toContain('123456');
    });

    it('redemande un code quand le premier est refusé (operator_proof_invalid), puis aboutit', async () => {
      const view = mount({
        decide: (request) => {
          if (!isDecision(request, 'approve')) return undefined;
          const code = request.body?.two_factor_code;
          if (code === undefined) return json(422, proofRequired);
          return code === '654321' ? json(200, { data: approvalData({ status: 'approved' }) }) : json(422, proofInvalid);
        },
      });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));
      await user.type(await screen.findByLabelText('Code de double authentification'), '000000');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await user.type(screen.getByLabelText('Code de double authentification'), '654321');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande validée')).toBeTruthy();
      expect(view.writes().map((request) => request.body?.two_factor_code)).toEqual([undefined, '000000', '654321']);
    });

    it('accepte un code de secours à la place du code de l’application', async () => {
      const view = mount({
        decide: (request) => {
          if (!isDecision(request, 'reject')) return undefined;
          return request.body?.recovery_code === 'abcde-fghij' ? json(200, { data: approvalData({ status: 'rejected' }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Refuser' }));
      await user.click(await screen.findByRole('button', { name: 'Refuser' }));
      await user.click(await screen.findByRole('button', { name: 'Utiliser un code de secours' }));
      await user.type(screen.getByLabelText('Code de secours'), 'abcde-fghij');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande refusée')).toBeTruthy();
      expect(view.writes().at(-1)?.body).toEqual({ recovery_code: 'abcde-fghij' });
    });

    it('n’exécute rien quand on annule la modale de preuve et garde la boîte ouverte avec l’erreur', async () => {
      const view = mount({ decide: (request) => (isDecision(request, 'approve') ? json(422, proofRequired) : undefined) });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));
      await screen.findByLabelText('Code de double authentification');
      await user.click(within(screen.getByRole('dialog', { name: 'Confirmer avec votre code' })).getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByText(proofRequired.detail)).toBeTruthy();
      expect(screen.queryByText('Demande validée')).toBeNull();
      expect(view.writes()).toHaveLength(1);
    });

    it('refuse un code mal formé sans rien envoyer', async () => {
      const view = mount({ decide: (request) => (isDecision(request, 'approve') ? json(422, proofRequired) : undefined) });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));
      await user.type(await screen.findByLabelText('Code de double authentification'), '12');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Saisissez les 6 chiffres affichés par votre application.')).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
    });

    it('ne propose ni valider ni refuser pour sa propre demande, seulement l’annulation', async () => {
      const own = approvalData({ requested_by: { id: IDS.me, name: 'Awa Diallo' }, permissions: { can_decide: false, can_cancel: true } });
      mount({ rows: [own] });
      const user = userEvent.setup();
      const detail = await openDetail(user);

      expect(within(detail).getByText('Vous avez déposé cette demande : un second opérateur doit la traiter.')).toBeTruthy();
      expect(within(detail).queryByRole('button', { name: 'Valider' })).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Refuser' })).toBeNull();
      expect(within(detail).getByRole('button', { name: 'Annuler ma demande' })).toBeTruthy();
      await expectNoA11yViolations(detail);
    });

    it('n’affiche aucune action quand le serveur n’accorde aucune permission, même pour une demande en attente', async () => {
      mount({ rows: [approvalData({ permissions: { can_decide: false, can_cancel: false } })] });
      const user = userEvent.setup();
      const detail = await openDetail(user);

      expect(within(detail).queryByRole('button', { name: 'Valider' })).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Refuser' })).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Annuler ma demande' })).toBeNull();
      expect(within(detail).queryByText(/Vous avez déposé cette demande/)).toBeNull();
    });

    it('annule sa demande avec la preuve 2FA', async () => {
      const own = approvalData({ requested_by: { id: IDS.me, name: 'Awa Diallo' }, permissions: { can_decide: false, can_cancel: true } });
      const view = mount({
        rows: [own],
        decide: (request) => {
          if (!isDecision(request, 'cancel')) return undefined;
          return request.body?.two_factor_code === '111222' ? json(200, { data: approvalData({ status: 'cancelled' }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Annuler ma demande' }));
      await user.click(await screen.findByRole('button', { name: 'Annuler la demande' }));
      await user.type(await screen.findByLabelText('Code de double authentification'), '111 222');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande annulée')).toBeTruthy();
      expect(view.writes().at(-1)?.body).toEqual({ two_factor_code: '111222' });
    });

    it.each([
      [403, problem(403, 'approval_self_forbidden', 'Vous ne pouvez pas valider votre propre demande.'), 'Vous ne pouvez pas valider votre propre demande.'],
      [403, problem(403, 'approval_role_forbidden', 'Votre rôle ne permet pas de décider cette action.'), 'Votre rôle ne permet pas de décider cette action.'],
      [404, problem(404, 'not_found', 'Cette demande n’existe plus.'), 'Cette demande n’existe plus.'],
      [409, problem(409, 'approval_not_pending', 'Cette demande n’est plus en attente.'), 'Cette demande n’est plus en attente.'],
      [409, problem(409, 'approval_expired', 'Cette demande a expiré.'), 'Cette demande a expiré.'],
      [429, problem(429, 'too_many_requests', 'Trop de tentatives.'), 'Trop de tentatives.'],
    ])('affiche l’erreur %i du serveur dans la boîte sans fermer ni annoncer de succès', async (status, body, message) => {
      mount({ decide: (request) => (isDecision(request, 'approve') ? json(status, body) : undefined) });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByText('Demande validée')).toBeNull();
      expect(screen.getByRole('button', { name: 'Valider et exécuter' })).toBeTruthy();
    });

    it('recharge la liste après une décision réussie', async () => {
      let decided = false;
      const view = mount({
        list: () => json(200, approvalList(decided ? [] : [approvalData()])),
        decide: (request) => {
          if (!isDecision(request, 'approve')) return undefined;
          decided = true;
          return json(200, { data: approvalData({ status: 'approved' }) });
        },
      });
      const user = userEvent.setup();
      await user.click(within(await openDetail(user)).getByRole('button', { name: 'Valider' }));
      await user.click(await screen.findByRole('button', { name: 'Valider et exécuter' }));

      expect(await screen.findByText('Aucune demande ne correspond')).toBeTruthy();
      expect(view.requests.filter((request) => request.method === 'GET' && request.url.pathname === '/api/v1/console/approvals').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('explique l’échec d’exécution d’une demande validée et propose le sujet', async () => {
    mount({ rows: [approvalData({ status: 'failed', failure_code: 'approval_stale', permissions: { can_decide: false, can_cancel: false } })], meta: { pending_count: 0 } });
    const user = userEvent.setup();
    const detail = await openDetail(user);

    expect(within(detail).getByText(/La situation a changé : rien n’a été modifié/)).toBeTruthy();
    expect(within(detail).getByRole('link', { name: /organisation/i }).getAttribute('href')).toBe(`/organisations/${IDS.org}`);
  });
  it('traduit le motif de la demande au lieu d’afficher son code', async () => {
    mount();
    const user = userEvent.setup();
    const detail = await openDetail(user);

    expect(within(detail).getByText('Fraude')).toBeTruthy();
    expect(within(detail).queryByText('fraud')).toBeNull();
  });

  it('affiche l’empreinte SHA-256 d’une demande de publication de plan', async () => {
    const sha = 'a3f5c9e1b2d47860fe1c2a9b8d7e6f5041322334455667788990aabbccddeeff';
    mount({ rows: [approvalData({ action: 'subscriptions.plan_version.publish', subject: { type: 'plan_version', id: IDS.user }, payload: { plan: 'gold', version: '3', content_sha256: sha } })] });
    const user = userEvent.setup();
    const detail = await openDetail(user);

    expect(within(detail).getByText('Empreinte du contenu (SHA-256)')).toBeTruthy();
    expect(within(detail).getByText(sha)).toBeTruthy();
    expect(within(detail).getByText('gold')).toBeTruthy();
  });
});
