import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { json } from '../../../test/platform';
import { expectNoA11yViolations } from '../../../test/axe';
import { accountFile } from '@/platform/accounts/fixtures';
import { problem, roleRequired } from '@/platform/fixtures';
import { rolesLoaded } from '../organisations/testSupport';
import { actions, open, suspended, user } from './testSupport';

const FORBIDDEN_DEMO_TEXTS = ['Inès Garnier', 'Marc Chevalier', 'Sophie Delmas', 'Résidences du Parc'];

describe('fiche compte (mode API)', () => {
  it('affiche identité, double authentification, appareils, jetons, profils et organisations', async () => {
    const { container } = open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Jeanne Martin' })).toBeTruthy();
    const identity = within(screen.getByRole('region', { name: 'Identité et accès' }));
    expect(identity.getByText('jeanne@exemple.fr')).toBeTruthy();
    expect(identity.getByText('Vérifiée')).toBeTruthy();
    expect(identity.getByText('Activée')).toBeTruthy();
    expect(identity.getByText('Codes de secours restants').nextElementSibling?.textContent).toBe('2');
    expect(identity.getByText('Appareils').nextElementSibling?.textContent).toBe('1');
    expect(identity.getByText('Jetons actifs').nextElementSibling?.textContent).toBe('1');
    expect(identity.getByText('Organisation, Locataire')).toBeTruthy();
    expect(identity.getByText('Organisations').nextElementSibling?.textContent).toBe('2');
    for (const text of FORBIDDEN_DEMO_TEXTS) expect(container.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it('affiche un squelette pendant le chargement', () => {
    open();

    expect(screen.getByRole('status', { name: /Chargement/ })).toBeTruthy();
  });

  it('présente un compte introuvable (404), un refus 403 et une limitation 429', async () => {
    const missing = open({ account: () => json(404, problem(404, 'account_not_found', 'Compte introuvable.')) });
    expect(await screen.findByRole('heading', { name: 'Compte introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à la recherche' }).getAttribute('href')).toBe('/comptes');
    missing.unmount();

    const forbidden = open({ account: () => json(403, roleRequired) });
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    forbidden.unmount();

    open({ account: () => json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '9' }) });
    expect(await screen.findByText(/Réessayez dans 9 s/)).toBeTruthy();
  });

  it('propose Réessayer après une panne serveur', async () => {
    const run = user();
    let calls = 0;
    open({
      account: () => {
        calls += 1;
        return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, { data: accountFile() });
      },
    });

    await run.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 3000 }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jeanne Martin' })).toBeTruthy();
  });

  describe('comptes sans action', () => {
    it('un compte supprimé reste lisible et n’offre aucune action', async () => {
      const view = open({ account: () => json(200, { data: accountFile({ email: null, deleted: true, deleted_at: '2026-11-10T10:00:00+00:00', last_login_at: null, two_factor: { enabled: false, recovery_codes_remaining: null } }) }) });

      expect(await screen.findByText('Compte supprimé')).toBeTruthy();
      expect(screen.getByText('Adresse non communiquée')).toBeTruthy();
      await rolesLoaded(view);
      expect(screen.queryByRole('region', { name: 'Actions' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Révoquer|Suspendre|Réinitialiser|Demander/ })).toBeNull();
    });

    it('un compte opérateur est géré par commande sur le serveur', async () => {
      const view = open({ account: () => json(200, { data: accountFile({ is_operator: true, profile_types: ['operator'] }) }) });

      expect(await screen.findByText(/géré par commande sur le serveur/)).toBeTruthy();
      await rolesLoaded(view);
      expect(screen.queryByRole('region', { name: 'Actions' })).toBeNull();
    });
  });

  describe('boutons selon le rôle et l’état', () => {
    it('administrateur et support : révoquer, suspendre, réinitialiser la 2FA ; pas de revue', async () => {
      for (const role of ['admin', 'support']) {
        const view = open({ roles: [role] });
        await screen.findByRole('region', { name: 'Actions' });
        for (const name of ['Révoquer les sessions', 'Suspendre le compte', 'Réinitialiser la double authentification']) expect(actions().getByRole('button', { name })).toBeTruthy();
        expect(actions().queryByRole('button', { name: 'Revoir la suspension' })).toBeNull();
        view.unmount();
      }
    });

    it('support : pas de revue d’une suspension non revue (réservée à l’administration et à la conformité)', async () => {
      open({ roles: ['support'], account: () => json(200, { data: suspended() }) });

      expect(await screen.findByRole('button', { name: 'Demander la réactivation' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Revoir la suspension' })).toBeNull();
    });

    it('administrateur : peut revoir une suspension non revue', async () => {
      open({ roles: ['admin'], account: () => json(200, { data: suspended() }) });

      expect(await screen.findByRole('button', { name: 'Revoir la suspension' })).toBeTruthy();
    });

    it('conformité : revue d’une suspension non revue, rien d’autre', async () => {
      open({ roles: ['compliance'], account: () => json(200, { data: suspended() }) });

      expect(await screen.findByRole('button', { name: 'Revoir la suspension' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Révoquer|Suspendre|Réinitialiser|Demander/ })).toBeNull();
    });

    it('conformité sans suspension, ou suspension déjà revue : aucune action', async () => {
      const plain = open({ roles: ['compliance'] });
      await screen.findByRole('heading', { level: 1, name: 'Jeanne Martin' });
      await rolesLoaded(plain);
      expect(screen.queryByRole('region', { name: 'Actions' })).toBeNull();
      plain.unmount();

      const reviewed = open({ roles: ['compliance'], account: () => json(200, { data: suspended({ reviewed: true, reviewed_at: '2026-11-20T15:00:00+00:00' }) }) });
      await screen.findByText(/Suspension revue le/);
      await rolesLoaded(reviewed);
      expect(screen.queryByRole('region', { name: 'Actions' })).toBeNull();
    });

    it('un compte suspendu propose la réactivation, plus la suspension, et dit que la revue est requise', async () => {
      open({ account: () => json(200, { data: suspended() }) });

      expect(await screen.findByText(/Revue a posteriori requise/)).toBeTruthy();
      expect(screen.getByText(/motif : Fraude/)).toBeTruthy();
      await screen.findByRole('region', { name: 'Actions' });
      expect(actions().getByRole('button', { name: 'Demander la réactivation' })).toBeTruthy();
      expect(actions().queryByRole('button', { name: 'Suspendre le compte' })).toBeNull();
    });

    it('sans double authentification, pas de réinitialisation à proposer', async () => {
      open({ account: () => json(200, { data: accountFile({ two_factor: { enabled: false, recovery_codes_remaining: null } }) }) });

      await screen.findByRole('region', { name: 'Actions' });
      expect(actions().queryByRole('button', { name: 'Réinitialiser la double authentification' })).toBeNull();
    });
  });
});
