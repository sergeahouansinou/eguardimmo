import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest, Responder } from '../../../test/platform';
import { expectNoA11yViolations } from '../../../test/axe';
import { IDS, approvalData, problem, proofInvalid, proofRequired, roleRequired } from '@/platform/fixtures';
import { entitlementsView, organisationDetail, suspendedSuspension, supportAccess } from '@/platform/organisations/fixtures';
import { OrganisationScreen } from './OrganisationScreen';
import { consolePath, rolesLoaded, withOperator } from './testSupport';

const OVERRIDE_ID = '01934f6e-2222-7000-8000-000000000001';
const REASON = 'Soupçon de fraude documentaire signalé.';
const FORBIDDEN_DEMO_TEXTS = ['Résidences du Parc', 'Inès Garnier', 'Cabinet Delmas'];

interface Setup {
  roles?: string[];
  pending?: Record<string, unknown>[];
  organisation?: () => Response;
  entitlements?: () => Response;
  accesses?: (search: URLSearchParams) => Response;
  approvals?: (request: RecordedRequest) => Response;
}

function server({ roles, pending, organisation, entitlements, accesses, approvals }: Setup = {}): Responder {
  return withOperator({ roles, pending }, (request) => {
    const path = consolePath(request);
    if (request.method === 'GET' && path === `/organizations/${IDS.org}`) return (organisation ?? (() => json(200, { data: organisationDetail() })))();
    if (request.method === 'GET' && path === `/organizations/${IDS.org}/entitlements`) return (entitlements ?? (() => json(200, entitlementsView())))();
    if (request.method === 'GET' && path === `/organizations/${IDS.org}/support-accesses`) {
      return (accesses ?? (() => json(200, { data: [supportAccess(), supportAccess({ id: '01934f6e-1111-7000-8000-000000000002', reason: null, status: 'expired' })], meta: { has_more: false, next_cursor: null } })))(request.url.searchParams);
    }
    if (request.method === 'POST' && path === '/approvals') return (approvals ?? (() => json(201, { data: approvalData() })))(request);
    return undefined;
  });
}

const open = (setup?: Setup) => renderPlatform(<OrganisationScreen id={IDS.org} />, server(setup));
const proofCodeField = () => screen.findByRole('textbox', { name: 'Code de double authentification' });

describe('fiche organisation (mode API)', () => {
  it('affiche la fiche, les droits effectifs et les accès du support', async () => {
    const { container } = open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Agence du Port' })).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Awa Diallo' }).getAttribute('href')).toBe(`/comptes/${IDS.user}`);
    expect(screen.getByText('Non exigée')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Modules et droits' }).getAttribute('href')).toBe(`/organisations/${IDS.org}/modules`);

    const rights = await screen.findByRole('table', { name: 'Droits de l’organisation' });
    expect(within(rights).getByRole('row', { name: /Lots.*Quota.*50.*Plan/ })).toBeTruthy();
    expect(within(rights).getByRole('row', { name: /Utilisateurs.*10.*Dérogation/ })).toBeTruthy();
    expect(within(rights).getByRole('row', { name: /Rapprochement bancaire.*Non incluse/ })).toBeTruthy();
    const overrides = screen.getByRole('table', { name: 'Dérogations de l’organisation' });
    expect(within(overrides).getByText('Geste commercial')).toBeTruthy();
    expect(within(overrides).getByText('En vigueur')).toBeTruthy();

    const accesses = await screen.findByRole('table', { name: 'Accès du support' });
    expect(within(accesses).getByText('Aide à la configuration des accès')).toBeTruthy();
    expect(within(accesses).getByText('Non communiqué à votre rôle')).toBeTruthy();
    for (const text of FORBIDDEN_DEMO_TEXTS) expect(container.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it('indique « Aucun abonnement » sans bloquer le reste de la fiche (404 subscription_not_found)', async () => {
    open({ entitlements: () => json(404, problem(404, 'subscription_not_found', 'Cette organisation n’a pas d’abonnement.')) });

    expect(await screen.findByText(/Aucun abonnement/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Agence du Port' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: 'Accès du support' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('présente une organisation introuvable (404)', async () => {
    open({ organisation: () => json(404, problem(404, 'organization_not_found', 'Organisation introuvable.')) });

    expect(await screen.findByRole('heading', { name: 'Organisation introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux organisations' }).getAttribute('href')).toBe('/organisations');
  });

  it('gère 403 et 429 sur la fiche', async () => {
    const forbidden = open({ organisation: () => json(403, roleRequired) });
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    forbidden.unmount();

    open({ organisation: () => json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '5' }) });
    expect(await screen.findByText('Trop de requêtes')).toBeTruthy();
  });

  it('affiche un loader pendant le chargement', () => {
    open();

    expect(screen.getByRole('status', { name: /Chargement/ })).toBeTruthy();
  });

  it('signale un refus 403 sur les accès du support sans masquer la fiche', async () => {
    open({ accesses: () => json(403, roleRequired) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Agence du Port' })).toBeTruthy();
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
  });

  it('filtre les accès du support par statut et pagine par curseur', async () => {
    const user = userEvent.setup();
    const seen: URLSearchParams[] = [];
    open({
      accesses: (search) => {
        seen.push(search);
        return json(200, { data: [supportAccess()], meta: { has_more: search.get('cursor') === null, next_cursor: search.get('cursor') === null ? 'a2' : null } });
      },
    });
    await screen.findByRole('table', { name: 'Accès du support' });

    await user.click(screen.getByRole('button', { name: 'Accès suivants' }));
    await waitFor(() => { expect(seen.some((search) => search.get('cursor') === 'a2')).toBe(true); });

    await user.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Actif' }));
    await waitFor(() => { expect(seen.at(-1)?.get('status')).toBe('active'); });
    expect(seen.at(-1)?.has('cursor')).toBe(false);
  });

  describe('boutons selon le rôle', () => {
    it('administrateur et support demandent suspension, pas dérogation', async () => {
      for (const role of ['admin', 'support']) {
        const view = open({ roles: [role] });
        expect(await screen.findByRole('button', { name: 'Demander la suspension' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Demander une dérogation' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
        view.unmount();
      }
    });

    it('facturation demande dérogation et retrait, pas suspension', async () => {
      open({ roles: ['billing'] });

      expect(await screen.findByRole('button', { name: 'Demander une dérogation' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retirer' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Demander la suspension' })).toBeNull();
    });

    it('conformité ne voit aucune action de demande', async () => {
      const view = open({ roles: ['compliance'] });
      await screen.findByRole('heading', { level: 1, name: 'Agence du Port' });
      await rolesLoaded(view);

      expect(screen.queryByRole('button', { name: /Demander/ })).toBeNull();
    });

    it('une organisation suspendue propose la réactivation et affiche le motif', async () => {
      open({ organisation: () => json(200, { data: organisationDetail({ state: 'suspended', suspension: suspendedSuspension }) }) });

      expect(await screen.findByRole('button', { name: 'Demander la réactivation' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Demander la suspension' })).toBeNull();
      expect(screen.getByText(/motif : Fraude/)).toBeTruthy();
    });
  });

  describe('demande de suspension (double validation)', () => {
    const openDialog = async (setup?: Setup) => {
      const user = userEvent.setup();
      const view = open(setup);
      await user.click(await screen.findByRole('button', { name: 'Demander la suspension' }));
      const dialog = await screen.findByRole('dialog', { name: 'Suspendre Agence du Port' });
      return { user, view, dialog };
    };
    const fill = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
      await user.click(within(dialog).getByRole('radio', { name: 'Fraude' }));
      await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), REASON);
    };

    it('offre les quatre motifs fermés, jamais l’impayé', async () => {
      const { dialog } = await openDialog();

      expect(within(dialog).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['fraud', 'abuse', 'legal_order', 'security']);
      expect(within(dialog).queryByRole('radio', { name: /impay/i })).toBeNull();
    });

    it('refuse l’envoi sans motif de suspension ni motif libre', async () => {
      const { user, view, dialog } = await openDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));
      expect(await within(dialog).findByText('Choisissez un motif de suspension.')).toBeTruthy();
      await user.click(within(dialog).getByRole('radio', { name: 'Abus' }));
      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));
      expect(await within(dialog).findByText(/au moins 10 caractères/i)).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('dépose la demande avec action, sujet, motif et charge utile en chaînes', async () => {
      const { user, view, dialog } = await openDialog();
      await fill(user, dialog);

      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()).toHaveLength(1);
      expect(view.writes()[0]?.body).toEqual({ action: 'organizations.suspend', subject_id: IDS.org, reason: REASON, payload: { reason_code: 'fraud' } });
      expect(screen.queryByRole('dialog', { name: 'Suspendre Agence du Port' })).toBeNull();
    });

    it('rejoue la demande avec le code 2FA saisi quand le serveur le réclame', async () => {
      let calls = 0;
      const { user, view, dialog } = await openDialog({
        approvals: () => {
          calls += 1;
          return calls === 1 ? json(422, proofRequired) : json(201, { data: approvalData() });
        },
      });
      await fill(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      await user.type(await proofCodeField(), '123456');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      const writes = view.writes();
      expect(writes).toHaveLength(2);
      expect(writes[0]?.body).not.toHaveProperty('two_factor_code');
      expect(writes[1]?.body).toMatchObject({ action: 'organizations.suspend', payload: { reason_code: 'fraud' }, two_factor_code: '123456' });
    });

    it('redemande un code après un code invalide, puis aboutit', async () => {
      const answers = [json(422, proofRequired), json(422, proofInvalid), json(201, { data: approvalData() })];
      const { user, view, dialog } = await openDialog({ approvals: () => answers.shift() ?? json(500, {}) });
      await fill(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      await user.type(await proofCodeField(), '111111');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await user.type(await proofCodeField(), '222222');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes().map((write) => write.body?.two_factor_code)).toEqual([undefined, '111111', '222222']);
    });

    it('abandonne sans rien déposer quand l’opérateur annule la saisie du code', async () => {
      const { user, view, dialog } = await openDialog({ approvals: () => json(422, proofRequired) });
      await fill(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      await proofCodeField();
      await user.click(screen.getByRole('button', { name: 'Annuler' }));

      await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Confirmer avec votre code' })).toBeNull(); });
      expect(screen.queryByText('Demande déposée')).toBeNull();
      expect(view.writes()).toHaveLength(1);
      expect(await screen.findByText(/code de double authentification/i)).toBeTruthy();
    });

    it('affiche le refus du serveur dans la fenêtre : 409 demande déjà en attente', async () => {
      const { user, dialog } = await openDialog({ approvals: () => json(409, problem(409, 'approval_pending_exists', 'Une demande est déjà en attente pour cette action.')) });
      await fill(user, dialog);

      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      expect(await within(dialog).findByText('Une demande est déjà en attente pour cette action.')).toBeTruthy();
      expect(screen.queryByText('Demande déposée')).toBeNull();
    });

    it('affiche le refus 403 de rôle et le 422 de validation', async () => {
      const answers = [json(403, roleRequired), json(422, problem(422, 'validation_failed', 'Données invalides.'))];
      const { user, dialog } = await openDialog({ approvals: () => answers.shift() ?? json(500, {}) });
      await fill(user, dialog);

      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));
      expect(await within(dialog).findByText(roleRequired.detail)).toBeTruthy();
      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));
      expect(await within(dialog).findByText('Données invalides.')).toBeTruthy();
    });

    it('affiche le refus 429', async () => {
      const { user, dialog } = await openDialog({ approvals: () => json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '30' }) });
      await fill(user, dialog);

      await user.click(within(dialog).getByRole('button', { name: 'Demander la suspension' }));

      expect(await within(dialog).findByText(/Réessayez dans 30 s/)).toBeTruthy();
    });
  });

  it('demande la réactivation d’une organisation suspendue', async () => {
    const user = userEvent.setup();
    const view = open({ organisation: () => json(200, { data: organisationDetail({ state: 'suspended', suspension: suspendedSuspension }) }) });
    await user.click(await screen.findByRole('button', { name: 'Demander la réactivation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Réactiver Agence du Port' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Dossier régularisé après vérification.');
    await user.click(within(dialog).getByRole('button', { name: 'Demander la réactivation' }));

    expect(await screen.findByText('Demande déposée')).toBeTruthy();
    expect(view.writes()[0]?.body).toEqual({ action: 'organizations.reactivate', subject_id: IDS.org, reason: 'Dossier régularisé après vérification.' });
  });

  it('indique l’attente d’un second opérateur et masque le bouton correspondant', async () => {
    open({ pending: [approvalData({ action: 'organizations.suspend', subject: { type: 'organization', id: IDS.org } })] });

    expect(await screen.findByText('En attente d’un second opérateur')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir les approbations' }).getAttribute('href')).toBe('/approbations');
    expect(screen.queryByRole('button', { name: 'Demander la suspension' })).toBeNull();
  });

  it('ne tient pas compte d’une demande en attente portant sur une autre organisation', async () => {
    open({ pending: [approvalData({ subject: { type: 'organization', id: IDS.second } })] });

    expect(await screen.findByRole('button', { name: 'Demander la suspension' })).toBeTruthy();
    expect(screen.queryByText('En attente d’un second opérateur')).toBeNull();
  });

  describe('dérogations de droits (facturation)', () => {
    const futureDate = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const openGrant = async (setup?: Setup) => {
      const user = userEvent.setup();
      const view = open({ roles: ['billing'], ...setup });
      await user.click(await screen.findByRole('button', { name: 'Demander une dérogation' }));
      const dialog = await screen.findByRole('dialog', { name: 'Demander une dérogation de droits' });
      return { user, view, dialog };
    };

    it('envoie une charge utile entièrement en chaînes, limite comprise pour un quota', async () => {
      const { user, view, dialog } = await openGrant();
      await user.click(within(dialog).getByRole('combobox', { name: /^Fonction/ }));
      await user.click(await screen.findByRole('option', { name: /Lots/ }));
      await user.type(within(dialog).getByRole('textbox', { name: /^Limite/ }), '60');
      fireEvent.change(within(dialog).getByLabelText('Fin de la dérogation'), { target: { value: futureDate() } });
      await user.click(within(dialog).getByRole('radio', { name: 'Geste commercial' }));
      await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Geste suite à l’incident de mars.');

      await user.click(within(dialog).getByRole('button', { name: 'Demander la dérogation' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()[0]?.body).toEqual({
        action: 'subscriptions.override.grant',
        subject_id: IDS.org,
        reason: 'Geste suite à l’incident de mars.',
        payload: { feature: 'properties', enabled: 'true', ends_at: futureDate(), reason_code: 'commercial_gesture', limit_value: '60' },
      });
    });

    it('bloque côté écran une fonction, une date et un motif manquants', async () => {
      const { user, view, dialog } = await openGrant();
      await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Geste suite à l’incident de mars.');

      await user.click(within(dialog).getByRole('button', { name: 'Demander la dérogation' }));

      expect(await within(dialog).findByText('Choisissez la fonction concernée.')).toBeTruthy();
      expect(within(dialog).getByText('Indiquez la date de fin.')).toBeTruthy();
      expect(within(dialog).getByText('Choisissez un motif.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('affiche le 422 override_invalid renvoyé par le serveur', async () => {
      const { user, dialog } = await openGrant({ approvals: () => json(422, problem(422, 'override_invalid', 'Cette dérogation n’est pas valable.')) });
      await user.click(within(dialog).getByRole('combobox', { name: /^Fonction/ }));
      await user.click(await screen.findByRole('option', { name: /Rapprochement bancaire/ }));
      fireEvent.change(within(dialog).getByLabelText('Fin de la dérogation'), { target: { value: futureDate() } });
      await user.click(within(dialog).getByRole('radio', { name: 'Pilote' }));
      await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Pilote avec une agence partenaire.');

      await user.click(within(dialog).getByRole('button', { name: 'Demander la dérogation' }));

      expect(await within(dialog).findByText('Cette dérogation n’est pas valable.')).toBeTruthy();
    });

    it('demande le retrait d’une dérogation avec son identifiant pour sujet', async () => {
      const user = userEvent.setup();
      const view = open({ roles: ['billing'] });
      await user.click(await screen.findByRole('button', { name: 'Retirer' }));
      const dialog = await screen.findByRole('dialog', { name: /Retirer la dérogation/ });

      await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Dérogation accordée par erreur.');
      await user.click(within(dialog).getByRole('button', { name: 'Demander le retrait' }));

      expect(await screen.findByText('Demande déposée')).toBeTruthy();
      expect(view.writes()[0]?.body).toEqual({ action: 'subscriptions.override.revoke', subject_id: OVERRIDE_ID, reason: 'Dérogation accordée par erreur.' });
    });

    it('masque Retirer et signale l’attente quand un retrait est déjà demandé', async () => {
      open({ roles: ['billing'], pending: [approvalData({ action: 'subscriptions.override.revoke', subject: { type: 'override', id: OVERRIDE_ID } })] });

      expect(await screen.findByText('Retrait en attente d’un second opérateur')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
    });

    it('masque la demande de dérogation quand une dérogation est déjà en attente', async () => {
      open({ roles: ['billing'], pending: [approvalData({ action: 'subscriptions.override.grant', subject: { type: 'organization', id: IDS.org } })] });

      expect(await screen.findByText('Dérogation en attente d’un second opérateur')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Demander une dérogation' })).toBeNull();
    });
  });
});
