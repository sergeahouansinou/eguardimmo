import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, renderPlatform } from '../../../test/platform';
import { expectNoA11yViolations } from '../../../test/axe';
import { IDS, problem, roleRequired } from '@/platform/fixtures';
import { organisationList, organisationRow, suspendedSuspension } from '@/platform/organisations/fixtures';
import { OrganisationsScreen } from './OrganisationsScreen';
import { consolePath, withOperator } from './testSupport';

const FORBIDDEN_DEMO_TEXTS = ['Résidences du Parc', 'Inès Garnier', 'Cabinet Delmas', 'Gestion Les Tilleuls'];

const second = organisationRow({ id: IDS.second, name: 'Résidence des Lilas', kind: 'individual', state: 'suspended', suspension: suspendedSuspension, plan: null, subscription_status: null, members_count: 1 });

const listing = (handler: (search: URLSearchParams) => Response) =>
  withOperator({}, (request) => (request.method === 'GET' && consolePath(request) === '/organizations' ? handler(request.url.searchParams) : undefined));

describe('liste des organisations (mode API)', () => {
  it('affiche les colonnes du contrat et un lien vers chaque fiche', async () => {
    const { container, requests } = renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([organisationRow(), second]))));

    const table = await screen.findByRole('table', { name: 'Organisations' });
    for (const header of ['Organisation', 'Type', 'Pays', 'Création', 'État', 'Plan', 'Abonnement', 'Membres']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    const port = within(table).getByRole('link', { name: 'Agence du Port' });
    expect(port.getAttribute('href')).toBe(`/organisations/${IDS.org}`);
    expect(within(table).getByText('Agence')).toBeTruthy();
    expect(within(table).getByText('Particulier')).toBeTruthy();
    expect(within(table).getByText('Active')).toBeTruthy();
    expect(within(table).getByText('Suspendue')).toBeTruthy();
    expect(within(table).getByText('silver')).toBeTruthy();
    expect(within(table).getByText('Actif')).toBeTruthy();
    expect(requests.find((request) => consolePath(request) === '/organizations')?.url.searchParams.get('per_page')).toBe('25');
    for (const text of FORBIDDEN_DEMO_TEXTS) expect(container.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it('ne propose ni création ni modification', async () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([organisationRow()]))));
    await screen.findByRole('table', { name: 'Organisations' });

    expect(screen.queryByRole('button', { name: /créer|nouvelle|modifier|supprimer/i })).toBeNull();
  });

  it('montre un squelette pendant le chargement', () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([]))));

    expect(screen.getByRole('status', { name: /Chargement/ })).toBeTruthy();
  });

  it('affiche l’état vide quand aucune organisation ne correspond', async () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([]))));

    expect(await screen.findByText('Aucune organisation ne correspond')).toBeTruthy();
  });

  it('pagine par curseur : suivante envoie le curseur, précédente revient à la première page', async () => {
    const user = userEvent.setup();
    const { requests } = renderPlatform(
      <OrganisationsScreen />,
      listing((search) =>
        search.get('cursor') === 'c2'
          ? json(200, organisationList([second]))
          : json(200, organisationList([organisationRow()], { has_more: true, next_cursor: 'c2' })),
      ),
    );

    await screen.findByRole('link', { name: 'Agence du Port' });
    expect(screen.getByRole('button', { name: 'Page précédente' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    await screen.findByRole('link', { name: 'Résidence des Lilas' });

    const cursors = requests.filter((request) => consolePath(request) === '/organizations').map((request) => request.url.searchParams.get('cursor'));
    expect(cursors).toContain('c2');
    expect(screen.getByRole('button', { name: 'Page suivante' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Page précédente' }));
    await screen.findByRole('link', { name: 'Agence du Port' });
  });

  it('refuse une recherche de moins de trois caractères sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const { requests } = renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([organisationRow()]))));
    await screen.findByRole('table', { name: 'Organisations' });
    const before = requests.length;

    await user.type(screen.getByRole('textbox', { name: 'Nom (début)' }), 'ag');
    await user.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(screen.getByText('Saisissez au moins 3 caractères.')).toBeTruthy();
    expect(requests.length).toBe(before);
  });

  it('envoie les filtres choisis (nom, type, état, plan, abonnement) et efface', async () => {
    const user = userEvent.setup();
    const { requests } = renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([organisationRow()]))));
    await screen.findByRole('table', { name: 'Organisations' });

    await user.type(screen.getByRole('textbox', { name: 'Nom (début)' }), 'Agence');
    await user.click(screen.getByRole('combobox', { name: /^Type/ }));
    await user.click(await screen.findByRole('option', { name: 'Agence' }));
    await user.click(screen.getByRole('combobox', { name: /^État/ }));
    await user.click(await screen.findByRole('option', { name: 'Suspendue' }));
    await user.type(screen.getByRole('textbox', { name: 'Plan (code)' }), 'silver');
    await user.click(screen.getByRole('combobox', { name: /^Abonnement/ }));
    await user.click(await screen.findByRole('option', { name: 'Essai' }));
    await user.click(screen.getByRole('button', { name: 'Filtrer' }));

    await waitFor(() => {
      const last = requests.filter((request) => consolePath(request) === '/organizations').at(-1);
      expect(Object.fromEntries(last?.url.searchParams ?? [])).toMatchObject({ search: 'Agence', kind: 'agency', state: 'suspended', plan: 'silver', subscription_status: 'trialing' });
    });

    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    await waitFor(() => {
      const last = requests.filter((request) => consolePath(request) === '/organizations').at(-1);
      expect(last?.url.searchParams.has('kind')).toBe(false);
      expect(last?.url.searchParams.has('search')).toBe(false);
    });
  });

  it('propose Réessayer après une panne serveur (une relance automatique, puis le bouton) et recharge', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderPlatform(
      <OrganisationsScreen />,
      listing(() => {
        calls += 1;
        return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, organisationList([organisationRow()]));
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 3000 }));
    expect(await screen.findByRole('link', { name: 'Agence du Port' })).toBeTruthy();
  });

  it('explique un refus 403 par le rôle', async () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(403, roleRequired)));

    expect(await screen.findByText('Accès réservé')).toBeTruthy();
  });

  it('signale la limitation de débit 429 avec le délai', async () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '12' })));

    expect(await screen.findByText('Trop de requêtes')).toBeTruthy();
    expect(screen.getByText(/Réessayez dans 12 s/)).toBeTruthy();
  });

  it('refuse une réponse hors contrat plutôt que d’afficher des données douteuses', async () => {
    renderPlatform(<OrganisationsScreen />, listing(() => json(200, organisationList([organisationRow({ kind: 'tenant' })]))));

    expect(await screen.findByText(/Réponse inattendue du serveur/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
