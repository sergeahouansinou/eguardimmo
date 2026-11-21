import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { json } from '../../../test/platform';
import { accountFile } from '@/platform/accounts/fixtures';
import { IDS, approvalData, problem, proofInvalid, proofRequired } from '@/platform/fixtures';
import { ACCOUNT, actions, open, proofCode, suspended, user } from './testSupport';
import type { Setup } from './testSupport';

describe('actions sur la fiche compte (mode API)', () => {
  describe('révocation des sessions (effet immédiat, preuve 2FA)', () => {
    const openDialog = async (setup?: Setup) => {
      const run = user();
      const view = open(setup);
      await screen.findByRole('region', { name: 'Actions' });
      await run.click(actions().getByRole('button', { name: 'Révoquer les sessions' }));
      const dialog = await screen.findByRole('dialog', { name: 'Révoquer les sessions de Jeanne Martin' });
      return { run, view, dialog };
    };

    it('demande confirmation puis révoque, sans rien envoyer avant', async () => {
      const { run, view, dialog } = await openDialog();
      expect(view.writes()).toHaveLength(0);

      await run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      expect(await screen.findByText('Sessions révoquées')).toBeTruthy();
      expect(view.writes().map((write) => write.url.pathname)).toEqual([`/api/v1/console${ACCOUNT}/session-revocation`]);
    });

    it('annuler la confirmation n’envoie rien', async () => {
      const { run, view, dialog } = await openDialog();

      await run.click(within(dialog).getByRole('button', { name: 'Annuler' }));

      await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
      expect(view.writes()).toHaveLength(0);
    });

    it('rejoue avec le code saisi quand le serveur réclame la preuve (422 operator_proof_required)', async () => {
      let calls = 0;
      const { run, view, dialog } = await openDialog({
        write: () => {
          calls += 1;
          return calls === 1 ? json(422, proofRequired) : json(200, { data: accountFile() });
        },
      });
      await run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      await run.type(await proofCode(), '123456');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Sessions révoquées')).toBeTruthy();
      const writes = view.writes();
      expect(writes).toHaveLength(2);
      expect(writes[0]?.body).toBeNull();
      expect(writes[1]?.body).toEqual({ two_factor_code: '123456' });
    });

    it('accepte un code de secours à la place du code de l’application', async () => {
      let calls = 0;
      const { run, view, dialog } = await openDialog({
        write: () => {
          calls += 1;
          return calls === 1 ? json(422, proofRequired) : json(200, { data: accountFile() });
        },
      });
      await run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      await proofCode();
      await run.click(screen.getByRole('button', { name: 'Utiliser un code de secours' }));
      await run.type(screen.getByRole('textbox', { name: 'Code de secours' }), 'abcde-fghij');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Sessions révoquées')).toBeTruthy();
      expect(view.writes()[1]?.body).toEqual({ recovery_code: 'abcde-fghij' });
    });

    it('redemande un code après un code invalide', async () => {
      const answers = [json(422, proofRequired), json(422, proofInvalid), json(200, { data: accountFile() })];
      const { run, view, dialog } = await openDialog({ write: () => answers.shift() ?? json(500, {}) });
      await run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      await run.type(await proofCode(), '111111');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await run.type(await proofCode(), '222222');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Sessions révoquées')).toBeTruthy();
      expect(view.writes().map((write) => write.body?.two_factor_code)).toEqual([undefined, '111111', '222222']);
    });

    it('annuler la saisie du code abandonne l’action et le dit dans la fenêtre', async () => {
      const { run, view, dialog } = await openDialog({ write: () => json(422, proofRequired) });
      await run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      await proofCode();
      await run.click(screen.getByRole('button', { name: 'Annuler' }));

      await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Confirmer avec votre code' })).toBeNull(); });
      expect(screen.queryByText('Sessions révoquées')).toBeNull();
      expect(view.writes()).toHaveLength(1);
      expect(await within(screen.getByRole('dialog', { name: 'Révoquer les sessions de Jeanne Martin' })).findByText(/code de double authentification/i)).toBeTruthy();
    });

    it('affiche le refus du serveur : compte opérateur protégé (403), introuvable (404), limitation (429)', async () => {
      const answers = [
        json(403, problem(403, 'operator_account_protected', 'Ce compte opérateur ne se gère pas depuis la console.')),
        json(404, problem(404, 'account_not_found', 'Compte introuvable.')),
        json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '15' }),
      ];
      const { run, dialog } = await openDialog({ write: () => answers.shift() ?? json(500, {}) });
      const confirm = () => run.click(within(dialog).getByRole('button', { name: 'Révoquer les sessions' }));

      await confirm();
      expect(await within(dialog).findByText('Ce compte opérateur ne se gère pas depuis la console.')).toBeTruthy();
      await confirm();
      expect(await within(dialog).findByText('Compte introuvable.')).toBeTruthy();
      await confirm();
      expect(await within(dialog).findByText(/Réessayez dans 15 s/)).toBeTruthy();
    });
  });

  describe('suspension immédiate', () => {
    const openDialog = async (setup?: Setup) => {
      const run = user();
      const view = open(setup);
      await screen.findByRole('region', { name: 'Actions' });
      await run.click(actions().getByRole('button', { name: 'Suspendre le compte' }));
      const dialog = await screen.findByRole('dialog', { name: 'Suspendre Jeanne Martin' });
      return { run, view, dialog };
    };

    it('offre les quatre motifs fermés et exige d’en choisir un', async () => {
      const { run, view, dialog } = await openDialog();
      expect(within(dialog).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['fraud', 'abuse', 'legal_order', 'security']);

      await run.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));

      expect(await within(dialog).findByText('Choisissez un motif de suspension.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('envoie le motif choisi et confirme par un toast', async () => {
      const { run, view, dialog } = await openDialog({ write: () => json(200, { data: suspended() }) });

      await run.click(within(dialog).getByRole('radio', { name: 'Sécurité' }));
      await run.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));

      expect(await screen.findByText('Compte suspendu')).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
      expect(view.writes()[0]?.url.pathname).toBe(`/api/v1/console${ACCOUNT}/suspension`);
      expect(view.writes()[0]?.body).toEqual({ reason: 'security' });
    });

    it('rejoue la suspension avec le code 2FA', async () => {
      let calls = 0;
      const { run, view, dialog } = await openDialog({
        write: () => {
          calls += 1;
          return calls === 1 ? json(422, proofRequired) : json(200, { data: suspended() });
        },
      });
      await run.click(within(dialog).getByRole('radio', { name: 'Fraude' }));
      await run.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));

      await run.type(await proofCode(), '654321');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Compte suspendu')).toBeTruthy();
      expect(view.writes()[1]?.body).toEqual({ reason: 'fraud', two_factor_code: '654321' });
    });

    it('affiche le 409 account_already_suspended et le 422 de motif', async () => {
      const answers = [
        json(409, problem(409, 'account_already_suspended', 'Ce compte est déjà suspendu.')),
        json(422, problem(422, 'validation_failed', 'Motif refusé.')),
      ];
      const { run, dialog } = await openDialog({ write: () => answers.shift() ?? json(500, {}) });
      await run.click(within(dialog).getByRole('radio', { name: 'Abus' }));

      await run.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));
      expect(await within(dialog).findByText('Ce compte est déjà suspendu.')).toBeTruthy();
      await run.click(within(dialog).getByRole('button', { name: 'Suspendre le compte' }));
      expect(await within(dialog).findByText('Motif refusé.')).toBeTruthy();
    });
  });

  describe('revue a posteriori', () => {
    const openDialog = async (setup?: Setup) => {
      const run = user();
      const view = open({ roles: ['compliance'], account: () => json(200, { data: suspended() }), ...setup });
      await run.click(await screen.findByRole('button', { name: 'Revoir la suspension' }));
      const dialog = await screen.findByRole('dialog', { name: 'Revoir la suspension de Jeanne Martin' });
      return { run, view, dialog };
    };

    it('marque la suspension comme revue', async () => {
      const { run, view, dialog } = await openDialog({ write: () => json(200, { data: suspended({ reviewed: true, reviewed_at: '2026-11-21T08:00:00+00:00' }) }) });

      await run.click(within(dialog).getByRole('button', { name: 'Marquer comme revue' }));

      expect(await screen.findByText('Suspension revue')).toBeTruthy();
      expect(view.writes()[0]?.url.pathname).toBe(`/api/v1/console${ACCOUNT}/suspension/review`);
    });

    it('affiche le 403 suspension_review_forbidden quand l’opérateur a lui-même suspendu', async () => {
      const { run, dialog } = await openDialog({ write: () => json(403, problem(403, 'suspension_review_forbidden', 'Vous ne pouvez pas revoir une suspension que vous avez prononcée.')) });

      await run.click(within(dialog).getByRole('button', { name: 'Marquer comme revue' }));

      expect(await within(dialog).findByText('Vous ne pouvez pas revoir une suspension que vous avez prononcée.')).toBeTruthy();
    });

    it('affiche le 409 account_not_suspended', async () => {
      const { run, dialog } = await openDialog({ write: () => json(409, problem(409, 'account_not_suspended', 'Ce compte n’est pas suspendu.')) });

      await run.click(within(dialog).getByRole('button', { name: 'Marquer comme revue' }));

      expect(await within(dialog).findByText('Ce compte n’est pas suspendu.')).toBeTruthy();
    });
  });

  describe('demandes à double validation', () => {
    const REASON = 'Titulaire joint par son canal habituel.';

    it('demande la réactivation d’un compte suspendu', async () => {
      const run = user();
      const view = open({ account: () => json(200, { data: suspended() }), write: () => json(201, { data: approvalData({ action: 'identity.account.reactivate' }) }) });
      await run.click(await screen.findByRole('button', { name: 'Demander la réactivation' }));
      const dialog = await screen.findByRole('dialog', { name: 'Réactiver Jeanne Martin' });

      await run.type(within(dialog).getByRole('textbox', { name: 'Motif' }), REASON);
      await run.click(within(dialog).getByRole('button', { name: 'Demander la réactivation' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()[0]?.body).toEqual({ action: 'identity.account.reactivate', subject_id: IDS.user, reason: REASON });
    });

    it('exige la méthode de vérification pour réinitialiser la 2FA, puis l’envoie en chaîne', async () => {
      const run = user();
      const view = open({ write: () => json(201, { data: approvalData({ action: 'identity.account.reset_two_factor' }) }) });
      await run.click(await screen.findByRole('button', { name: 'Réinitialiser la double authentification' }));
      const dialog = await screen.findByRole('dialog', { name: /Réinitialiser la double authentification de Jeanne Martin/ });
      await run.type(within(dialog).getByRole('textbox', { name: 'Motif' }), REASON);

      await run.click(within(dialog).getByRole('button', { name: 'Demander la réinitialisation' }));
      expect(await within(dialog).findByText('Indiquez comment l’identité du titulaire a été vérifiée.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);

      await run.click(within(dialog).getByRole('radio', { name: 'Appel vidéo' }));
      await run.click(within(dialog).getByRole('button', { name: 'Demander la réinitialisation' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()[0]?.body).toEqual({ action: 'identity.account.reset_two_factor', subject_id: IDS.user, reason: REASON, payload: { verification_method: 'video_call' } });
    });

    it('rejoue la demande de réinitialisation avec le code 2FA', async () => {
      let calls = 0;
      const run = user();
      const view = open({
        write: () => {
          calls += 1;
          return calls === 1 ? json(422, proofRequired) : json(201, { data: approvalData({ action: 'identity.account.reset_two_factor' }) });
        },
      });
      await run.click(await screen.findByRole('button', { name: 'Réinitialiser la double authentification' }));
      const dialog = await screen.findByRole('dialog', { name: /Réinitialiser la double authentification/ });
      await run.type(within(dialog).getByRole('textbox', { name: 'Motif' }), REASON);
      await run.click(within(dialog).getByRole('radio', { name: 'Canal déjà connu' }));
      await run.click(within(dialog).getByRole('button', { name: 'Demander la réinitialisation' }));

      await run.type(await proofCode(), '246810');
      await run.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()[1]?.body).toMatchObject({ payload: { verification_method: 'known_channel' }, two_factor_code: '246810' });
    });

    it('affiche le 409 approval_pending_exists', async () => {
      const run = user();
      open({ account: () => json(200, { data: suspended() }), write: () => json(409, problem(409, 'approval_pending_exists', 'Une demande est déjà en attente pour cette action.')) });
      await run.click(await screen.findByRole('button', { name: 'Demander la réactivation' }));
      const dialog = await screen.findByRole('dialog', { name: 'Réactiver Jeanne Martin' });
      await run.type(within(dialog).getByRole('textbox', { name: 'Motif' }), REASON);

      await run.click(within(dialog).getByRole('button', { name: 'Demander la réactivation' }));

      expect(await within(dialog).findByText('Une demande est déjà en attente pour cette action.')).toBeTruthy();
    });

    it('signale l’attente d’un second opérateur et masque le bouton de la demande en cours', async () => {
      open({
        pending: [approvalData({ action: 'identity.account.reset_two_factor', subject: { type: 'user', id: IDS.user } })],
      });

      expect(await screen.findByText('En attente d’un second opérateur')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Voir les approbations' }).getAttribute('href')).toBe('/approbations');
      expect(screen.queryByRole('button', { name: 'Réinitialiser la double authentification' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Suspendre le compte' })).toBeTruthy();
    });
  });
});
