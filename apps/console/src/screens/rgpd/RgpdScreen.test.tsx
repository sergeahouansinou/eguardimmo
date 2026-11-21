import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { problem, proofInvalid, proofRequired } from '@/platform/fixtures';
import { PRIVACY_IDS, listResponse, requestData } from '@/platform/privacy/privacyFixtures';
import { chooseOption, consolePath, operatorLoaded, withOperator } from '../abonnements/testSupport';
import { RgpdScreen } from './RgpdScreen';

const isRecord = (request: RecordedRequest) => request.method === 'POST' && consolePath(request) === '/privacy-requests';
const listCalls = (requests: RecordedRequest[]) => requests.filter((request) => request.method === 'GET' && consolePath(request) === '/privacy-requests');

interface Setup {
  roles?: string[];
  list?: (request: RecordedRequest) => Response | undefined;
  write?: (request: RecordedRequest) => Response | undefined;
}

function mount({ roles = ['compliance'], list, write }: Setup = {}) {
  return renderPlatform(
    <RgpdScreen />,
    withOperator({ roles }, (request) => {
      if (request.method === 'GET' && consolePath(request) === '/privacy-requests') return list?.(request) ?? json(200, listResponse());
      return write?.(request);
    }),
  );
}

const enterCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.type(await screen.findByLabelText('Code de double authentification'), code);
  await user.click(screen.getByRole('button', { name: 'Confirmer' }));
};

describe('écran du registre RGPD', () => {
  it('liste les demandes avec compteurs, statuts français et retard visible, sans erreur d’accessibilité', async () => {
    const view = mount();

    const table = await screen.findByRole('table', { name: 'Demandes RGPD' });
    expect(within(table).getAllByText('Léa Fontaine')).toHaveLength(2);
    expect(within(table).getByText('Accès')).toBeTruthy();
    expect(within(table).getByText('Rectification')).toBeTruthy();
    expect(within(table).getAllByText('En retard')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Demandes ouvertes' }).textContent).toContain('2');
    expect(screen.getByRole('region', { name: 'Demandes en retard' }).textContent).toContain('1');
    expect(within(table).getAllByRole('link', { name: /Léa Fontaine/ })[0]?.getAttribute('href')).toBe(`/rgpd/${PRIVACY_IDS.request}`);
    await expectNoA11yViolations(view.container);
  });

  it('transmet statut, type et retard au serveur et revient à la première page', async () => {
    const view = mount({ list: () => json(200, listResponse(undefined, { has_more: true, next_cursor: 'curseur-2' })) });
    const user = userEvent.setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => { expect(listCalls(view.requests).some((request) => request.url.searchParams.get('cursor') === 'curseur-2')).toBe(true); });
    await chooseOption(user, /^Statut/, 'En cours');
    await chooseOption(user, /^Type/, 'Effacement');
    await chooseOption(user, /^Délai/, 'En retard uniquement');

    await waitFor(() => {
      const last = listCalls(view.requests).at(-1);
      expect(last?.url.searchParams.get('status')).toBe('in_progress');
      expect(last?.url.searchParams.get('kind')).toBe('erasure');
      expect(last?.url.searchParams.get('overdue')).toBe('1');
      expect(last?.url.searchParams.has('cursor')).toBe(false);
    });
  });

  it('affiche l’état vide quand aucune demande ne correspond', async () => {
    mount({ list: () => json(200, listResponse([])) });

    expect(await screen.findByText('Aucune demande')).toBeTruthy();
  });

  it.each([
    [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
    [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    [500, problem(500, 'server_error', 'Erreur interne.'), 'Les demandes RGPD n’a pas pu être chargé'],
  ])('affiche l’erreur %i du serveur', async (status, body, title) => {
    mount({ list: () => json(status, body, status === 429 ? { 'Retry-After': '8' } : {}) });

    expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
  });

  it('recharge par « Réessayer » après une panne', async () => {
    let calls = 0;
    mount({ list: () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.')) : json(200, listResponse())) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table', { name: 'Demandes RGPD' })).toBeTruthy();
  });

  it('refuse une demande dont le type est hors contrat', async () => {
    mount({ list: () => json(200, listResponse([requestData({ kind: 'inconnu' })])) });

    expect(await screen.findByText('Les demandes RGPD n’a pas pu être chargé')).toBeTruthy();
  });

  it('ne propose pas l’enregistrement d’une demande hors du rôle conformité', async () => {
    const view = mount({ roles: ['admin'] });
    await screen.findByRole('table');
    await operatorLoaded(view.requests);

    expect(screen.queryByRole('button', { name: 'Enregistrer une demande' })).toBeNull();
  });

  describe('enregistrement d’une demande reçue hors application', () => {
    const fill = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Enregistrer une demande' }));
      const dialog = await screen.findByRole('dialog');
      await chooseOption(user, /^Type de demande/, 'Effacement');
      await user.click(within(dialog).getByRole('radio', { name: 'Courrier' }));
      await user.type(within(dialog).getByLabelText('E-mail du demandeur'), 'claire.martin@exemple.fr');
      return dialog;
    };

    it('envoie la demande avec la preuve 2FA : 422 operator_proof_required, code, rejeu, succès', async () => {
      const view = mount({
        write: (request) => {
          if (!isRecord(request)) return undefined;
          return request.body?.two_factor_code === '123456' ? json(201, { data: requestData({ kind: 'erasure', channel: 'letter' }) }) : json(422, proofRequired);
        },
      });
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.type(within(dialog).getByLabelText('Date de réception (facultatif)'), '2026-11-18');
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));
      await enterCode(user, '123456');

      expect(await screen.findByText('Demande enregistrée')).toBeTruthy();
      expect(view.writes().map((request) => request.body)).toEqual([
        { kind: 'erasure', channel: 'letter', requester_email: 'claire.martin@exemple.fr', received_on: '2026-11-18' },
        { kind: 'erasure', channel: 'letter', requester_email: 'claire.martin@exemple.fr', received_on: '2026-11-18', two_factor_code: '123456' },
      ]);
      await waitFor(() => { expect(listCalls(view.requests).length).toBeGreaterThan(1); });
    });

    it('redemande un code refusé puis aboutit, et n’envoie pas received_on quand il est vide', async () => {
      const view = mount({
        write: (request) => {
          if (!isRecord(request)) return undefined;
          const code = request.body?.two_factor_code;
          if (code === undefined) return json(422, proofRequired);
          return code === '654321' ? json(201, { data: requestData() }) : json(422, proofInvalid);
        },
      });
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));
      await enterCode(user, '000000');
      expect(await screen.findByText('Ce code est incorrect ou a déjà été utilisé. Saisissez-en un nouveau.')).toBeTruthy();
      await user.type(screen.getByLabelText('Code de double authentification'), '654321');
      await user.click(screen.getByRole('button', { name: 'Confirmer' }));

      expect(await screen.findByText('Demande enregistrée')).toBeTruthy();
      expect(view.writes().map((request) => request.body?.two_factor_code)).toEqual([undefined, '000000', '654321']);
      expect(view.writes()[0]?.body).not.toHaveProperty('received_on');
    });

    it('garde la boîte ouverte avec l’erreur quand on annule la saisie du code', async () => {
      const view = mount({ write: (request) => (isRecord(request) ? json(422, proofRequired) : undefined) });
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));
      await screen.findByLabelText('Code de double authentification');
      await user.click(within(screen.getByRole('dialog', { name: 'Confirmer avec votre code' })).getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByText(proofRequired.detail)).toBeTruthy();
      expect(screen.queryByText('Demande enregistrée')).toBeNull();
      expect(view.writes()).toHaveLength(1);
    });

    it('valide le formulaire côté client sans rien envoyer', async () => {
      const view = mount();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Enregistrer une demande' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));

      expect(await within(dialog).findByText('Choisissez le type de demande.')).toBeTruthy();
      expect(within(dialog).getByText('Choisissez le canal de réception.')).toBeTruthy();
      expect(within(dialog).getByText('Saisissez l’adresse e-mail du demandeur.')).toBeTruthy();
      await user.type(within(dialog).getByLabelText('E-mail du demandeur'), 'pas-un-email');
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));
      expect(await within(dialog).findByText('Adresse e-mail invalide.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
      await expectNoA11yViolations(dialog);
    });

    it('refuse une date de réception future', async () => {
      const view = mount();
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.type(within(dialog).getByLabelText('Date de réception (facultatif)'), '2999-01-01');
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));

      expect(await within(dialog).findByText('La date de réception ne peut pas être dans le futur.')).toBeTruthy();
      expect(view.writes()).toHaveLength(0);
    });

    it('affiche le refus 422 du serveur dans la boîte', async () => {
      mount({ write: (request) => (isRecord(request) ? json(422, problem(422, 'privacy_deadline_passed', 'Cette date de réception est trop ancienne.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));

      expect(await within(dialog).findByText('Cette date de réception est trop ancienne.')).toBeTruthy();
    });

    it('affiche le refus 403 du serveur', async () => {
      mount({ write: (request) => (isRecord(request) ? json(403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.')) : undefined) });
      const user = userEvent.setup();
      const dialog = await fill(user);
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer la demande' }));

      expect(await within(dialog).findByText('Votre rôle d’opérateur ne permet pas cette opération.')).toBeTruthy();
    });
  });
});
