import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { IDS, approvalData, problem, proofInvalid, proofRequired } from '@/platform/fixtures';
import { PLAN_IDS, draftVersion, planData, planResponse, publishedVersion, versionResponse } from '@/platform/plans/planFixtures';
import { PlanScreen } from './PlanScreen';
import { consolePath, operatorLoaded, withOperator } from './testSupport';

const PUBLISH = 'subscriptions.plan_version.publish';
const isDraftPatch = (request: RecordedRequest) => request.method === 'PATCH' && consolePath(request) === `/plan-versions/${PLAN_IDS.v3}`;
const isApprovalRequest = (request: RecordedRequest) => request.method === 'POST' && consolePath(request) === '/approvals';
const isCreateDraft = (request: RecordedRequest) => request.method === 'POST' && consolePath(request) === '/plans/gold/versions';

interface Setup {
  roles?: string[];
  plan?: Record<string, unknown>;
  get?: (request: RecordedRequest) => Response | undefined;
  write?: (request: RecordedRequest) => Response | undefined;
  pending?: Record<string, unknown>[];
}

function mount({ roles = ['billing'], plan = planData(), get, write, pending }: Setup = {}) {
  return renderPlatform(
    <PlanScreen code="gold" />,
    withOperator({ roles, pending }, (request) => {
      if (request.method === 'GET' && consolePath(request) === '/plans/gold') return get?.(request) ?? json(200, planResponse(plan));
      return write?.(request);
    }),
  );
}

const enterCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.type(await screen.findByLabelText('Code de double authentification'), code);
  await user.click(screen.getByRole('button', { name: 'Confirmer' }));
};

const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Modifier le brouillon' }));
  return screen.findByRole('form', { name: 'Modifier le brouillon de la version 3' });
};

describe('écran d’un plan', () => {
  it('affiche le brouillon par défaut avec ses droits et ses prix, sans erreur d’accessibilité', async () => {
    const view = mount();

    expect(await screen.findByRole('heading', { name: 'Gold' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Version 3 · Brouillon', selected: true })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Droits de la version 3' })).toBeTruthy();
    expect(screen.getByText('39 € / mois · 390 € / an')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Modifier le brouillon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Demander la publication' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ouvrir un brouillon' })).toBeNull();
    await expectNoA11yViolations(view.container);
  });

  it('montre une version publiée en lecture seule, en euros et en dollars canadiens', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Version 2 · Publiée' }));

    expect(await screen.findByText('35 € / mois · 350 € / an')).toBeTruthy();
    expect(screen.getByText('49 CA$ / mois · 490 CA$ / an')).toBeTruthy();
    expect(screen.getAllByText('15 jours (fixé par la grille)').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Modifier le brouillon' })).toBeNull();
  });

  it('ne propose aucune action d’écriture à un rôle autre que facturation', async () => {
    const view = mount({ roles: ['support'] });

    expect(await screen.findByRole('table', { name: 'Droits de la version 3' })).toBeTruthy();
    await operatorLoaded(view.requests);
    expect(screen.queryByRole('button', { name: 'Modifier le brouillon' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Demander la publication' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ouvrir un brouillon' })).toBeNull();
  });

  describe('ouverture d’un brouillon', () => {
    const withoutDraft = () => planData({ versions: [publishedVersion()] });

    it('ouvre un brouillon avec la preuve 2FA : 422 operator_proof_required, code, rejeu, succès', async () => {
      let created = false;
      const view = mount({
        get: () => json(200, planResponse(created ? planData() : withoutDraft())),
        write: (request) => {
          if (!isCreateDraft(request)) return undefined;
          if (request.body?.two_factor_code !== '123456') return json(422, proofRequired);
          created = true;
          return json(201, versionResponse(draftVersion()));
        },
      });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Ouvrir un brouillon' }));
      await enterCode(user, '123456');

      expect(await screen.findByText('Brouillon ouvert')).toBeTruthy();
      expect(await screen.findByRole('tab', { name: 'Version 3 · Brouillon', selected: true })).toBeTruthy();
      expect(view.writes().map((request) => request.body?.two_factor_code)).toEqual([undefined, '123456']);
    });

    it('redemande un code refusé puis aboutit', async () => {
      const view = mount({
        plan: withoutDraft(),
        write: (request) => {
          if (!isCreateDraft(request)) return undefined;
          const code = request.body?.two_factor_code;
          if (code === undefined) return json(422, proofRequired);
          return code === '654321' ? json(201, versionResponse(draftVersion())) : json(422, proofInvalid);
        },
      });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Ouvrir un brouillon' }));
      await enterCode(user, '000000');
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await user.type(screen.getByLabelText('Code de double authentification'), '654321');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Brouillon ouvert')).toBeTruthy();
      expect(view.writes().map((request) => request.body?.two_factor_code)).toEqual([undefined, '000000', '654321']);
    });

    it('n’envoie rien de plus quand on annule la saisie du code et affiche l’erreur', async () => {
      const view = mount({ plan: withoutDraft(), write: (request) => (isCreateDraft(request) ? json(422, proofRequired) : undefined) });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Ouvrir un brouillon' }));
      await screen.findByLabelText('Code de double authentification');
      await user.click(within(screen.getByRole('dialog', { name: 'Confirmer avec votre code' })).getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByText(proofRequired.detail)).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
    });

    it('affiche le refus 409 plan_draft_exists du serveur', async () => {
      mount({ plan: withoutDraft(), write: (request) => (isCreateDraft(request) ? json(409, problem(409, 'plan_draft_exists', 'Un brouillon existe déjà pour ce plan.')) : undefined) });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Ouvrir un brouillon' }));

      expect(await screen.findByText('Un brouillon existe déjà pour ce plan.')).toBeTruthy();
    });
  });

  describe('édition du brouillon', () => {
    it('enregistre les prix, les droits et l’inscription publique convertis pour le serveur', async () => {
      const view = mount({ write: (request) => (isDraftPatch(request) ? (request.body?.two_factor_code === '123456' ? json(200, versionResponse(draftVersion())) : json(422, proofRequired)) : undefined) });
      const user = userEvent.setup();
      const form = await startEditing(user);
      await user.click(within(form).getByRole('switch', { name: 'Inscription publique' }));
      const monthly = within(form).getByLabelText('Mensuel en EUR');
      await user.clear(monthly);
      await user.type(monthly, '41,90');
      await user.type(within(form).getByLabelText('Mensuel en CAD'), '59');
      await user.type(within(form).getByLabelText('Annuel en CAD'), '590');
      const limit = within(form).getByLabelText('Limite : Baux');
      await user.clear(limit);
      await user.type(limit, '150');
      await user.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));
      await enterCode(user, '123456');

      expect(await screen.findByText('Brouillon enregistré')).toBeTruthy();
      const body = view.writes().at(-1)?.body as { public_signup: boolean; prices: unknown[]; entitlements: { feature: string; enabled: boolean; limit_value: number | null }[]; two_factor_code: string };
      expect(body.public_signup).toBe(true);
      expect(body.prices).toEqual([
        { currency: 'EUR', monthly_amount: 4190, yearly_amount: 39000 },
        { currency: 'CAD', monthly_amount: 5900, yearly_amount: 59000 },
      ]);
      expect(body.entitlements.find((entry) => entry.feature === 'leases')).toEqual({ feature: 'leases', enabled: true, limit_value: 150 });
      expect(body.entitlements.find((entry) => entry.feature === 'rent')).toEqual({ feature: 'rent', enabled: true, limit_value: null });
      expect(body.two_factor_code).toBe('123456');
    });

    it('refuse un prix incomplet et une limite invalide sans rien envoyer', async () => {
      const view = mount();
      const user = userEvent.setup();
      const form = await startEditing(user);
      await user.type(within(form).getByLabelText('Mensuel en CAD'), '59');
      const limit = within(form).getByLabelText('Limite : Baux');
      await user.clear(limit);
      await user.type(limit, '12abc');
      await user.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));

      expect(await within(form).findByText('Renseignez les deux montants, par exemple 35 ou 35,50.')).toBeTruthy();
      expect(within(form).getByText('La limite est un entier positif ; laissez vide pour illimité.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
      await expectNoA11yViolations(form);
    });

    it('affiche le refus 422 plan_version_invalid et le 409 plan_version_not_editable', async () => {
      let call = 0;
      mount({
        write: (request) => {
          if (!isDraftPatch(request)) return undefined;
          call += 1;
          return call === 1 ? json(422, problem(422, 'plan_version_invalid', 'Le prix annuel doit rester inférieur à douze mensualités.')) : json(409, problem(409, 'plan_version_not_editable', 'Cette version est publiée : elle ne se modifie plus.'));
        },
      });
      const user = userEvent.setup();
      const form = await startEditing(user);
      await user.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));
      expect(await within(form).findByText('Le prix annuel doit rester inférieur à douze mensualités.')).toBeTruthy();
      await user.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));

      expect(await within(form).findByText('Cette version est publiée : elle ne se modifie plus.')).toBeTruthy();
    });

    it('affiche tel quel le 409 plan_version_publication_pending quand une publication est en attente', async () => {
      const detail = 'Une demande de publication est en attente pour cette version : elle doit être traitée ou annulée avant toute modification.';
      mount({ write: (request) => (isDraftPatch(request) ? json(409, problem(409, 'plan_version_publication_pending', detail)) : undefined) });
      const user = userEvent.setup();
      const form = await startEditing(user);
      await user.click(within(form).getByRole('button', { name: 'Enregistrer le brouillon' }));

      expect(await within(form).findByText(detail)).toBeTruthy();
    });

    it('quitte l’édition sans écrire quand on annule', async () => {
      const view = mount();
      const user = userEvent.setup();
      const form = await startEditing(user);
      await user.click(within(form).getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByRole('button', { name: 'Modifier le brouillon' })).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });
  });

  describe('demande de publication par double validation', () => {
    const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Demander la publication' }));
      return screen.findByRole('dialog');
    };

    it('dépose la demande sur la version, après la preuve 2FA, et n’envoie ni code ni secret dans les lectures', async () => {
      const view = mount({
        write: (request) => {
          if (!isApprovalRequest(request)) return undefined;
          return request.body?.two_factor_code === '123456' ? json(201, { data: approvalData({ action: PUBLISH, subject: { type: 'plan_version', id: PLAN_IDS.v3 } }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.type(within(dialog).getByLabelText('Motif'), 'Nouveaux tarifs validés par la direction commerciale.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander la publication' }));
      await enterCode(user, '123456');

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      const bodies = view.writes().map((request) => request.body);
      expect(bodies[0]).toEqual({ action: PUBLISH, subject_id: PLAN_IDS.v3, reason: 'Nouveaux tarifs validés par la direction commerciale.' });
      expect(bodies[1]).toEqual({ action: PUBLISH, subject_id: PLAN_IDS.v3, reason: 'Nouveaux tarifs validés par la direction commerciale.', two_factor_code: '123456' });
      expect(JSON.stringify(view.requests.filter((request) => request.method === 'GET'))).not.toContain('123456');
    });

    it('refuse un motif trop court sans rien envoyer', async () => {
      const view = mount();
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.type(within(dialog).getByLabelText('Motif'), 'Trop bref');
      await user.click(within(dialog).getByRole('button', { name: 'Demander la publication' }));

      expect(await within(dialog).findByText('Le motif doit faire au moins 10 caractères.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('affiche la demande en attente et retire le bouton pour ne pas la doubler', async () => {
      mount({ pending: [approvalData({ action: PUBLISH, subject: { type: 'plan_version', id: PLAN_IDS.v3 } })] });

      expect(await screen.findByText('En attente d’un second opérateur')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Voir les approbations' }).getAttribute('href')).toBe('/approbations');
      expect(screen.queryByRole('button', { name: 'Demander la publication' })).toBeNull();
    });

    it('ignore une demande en attente qui porte sur une autre version', async () => {
      mount({ pending: [approvalData({ action: PUBLISH, subject: { type: 'plan_version', id: IDS.org } })] });

      expect(await screen.findByRole('button', { name: 'Demander la publication' })).toBeTruthy();
      expect(screen.queryByText('En attente d’un second opérateur')).toBeNull();
    });

    it('affiche le refus du serveur quand la demande échoue', async () => {
      mount({ write: (request) => (isApprovalRequest(request) ? json(422, problem(422, 'approval_subject_invalid', 'Cette version ne peut pas être publiée.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await openDialog(user);
      await user.type(within(dialog).getByLabelText('Motif'), 'Nouveaux tarifs validés par la direction commerciale.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander la publication' }));

      expect(await within(dialog).findByText('Cette version ne peut pas être publiée.')).toBeTruthy();
    });
  });

  describe('erreurs de chargement', () => {
    it('affiche « Plan introuvable » sur un 404', async () => {
      mount({ get: () => json(404, problem(404, 'plan_not_found', 'Ce plan n’existe pas.')) });

      expect(await screen.findByText('Plan introuvable')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Retour aux abonnements' }).getAttribute('href')).toBe('/abonnements');
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
      mount({ get: () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.')) : json(200, planResponse())) });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

      await waitFor(() => { expect(screen.getByRole('heading', { name: 'Gold' })).toBeTruthy(); });
    });
  });
});
