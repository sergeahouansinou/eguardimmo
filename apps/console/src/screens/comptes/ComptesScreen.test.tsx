import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, renderPlatform } from '../../../test/platform';
import { expectNoA11yViolations } from '../../../test/axe';
import { accountSummary } from '@/platform/accounts/fixtures';
import { IDS, problem, roleRequired } from '@/platform/fixtures';
import { consolePath, withOperator } from '../organisations/testSupport';
import { ComptesScreen } from './ComptesScreen';

const searching = (handler: (search: URLSearchParams) => Response) =>
  withOperator({}, (request) => (request.method === 'GET' && consolePath(request) === '/accounts' ? handler(request.url.searchParams) : undefined));

const accountRequests = (requests: { url: URL }[]) => requests.filter((request) => request.url.pathname.endsWith('/accounts'));

describe('recherche de comptes (mode API)', () => {
  it('n’expose aucune liste : seulement le formulaire de recherche exacte', async () => {
    const { container, requests } = renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [] })));

    expect(screen.getByRole('search', { name: 'Rechercher un compte' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(accountRequests(requests)).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it('cherche par adresse e-mail et mène à la fiche', async () => {
    const user = userEvent.setup();
    const { container, requests } = renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [accountSummary({ suspended: true })] })));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    const link = await screen.findByRole('link', { name: 'Jeanne Martin' });
    expect(link.getAttribute('href')).toBe(`/comptes/${IDS.user}`);
    expect(screen.getByText('jeanne@exemple.fr')).toBeTruthy();
    expect(screen.getByText('Suspendu')).toBeTruthy();
    expect(Object.fromEntries(accountRequests(requests)[0]?.url.searchParams ?? [])).toEqual({ email: 'jeanne@exemple.fr' });
    await expectNoA11yViolations(container);
  });

  it('cherche par identifiant dans le second mode', async () => {
    const user = userEvent.setup();
    const { requests } = renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [accountSummary()] })));

    await user.click(screen.getByRole('radio', { name: 'Identifiant du compte' }));
    await user.type(screen.getByRole('textbox', { name: 'Identifiant exact' }), IDS.user);
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    await screen.findByRole('link', { name: 'Jeanne Martin' });
    expect(Object.fromEntries(accountRequests(requests)[0]?.url.searchParams ?? [])).toEqual({ id: IDS.user });
  });

  it('affiche les pastilles supprimé et opérateur', async () => {
    const user = userEvent.setup();
    renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [accountSummary({ deleted: true, is_operator: true, email: null })] })));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'x@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Supprimé')).toBeTruthy();
    expect(screen.getByText('Opérateur')).toBeTruthy();
    expect(screen.getByText('Adresse non communiquée')).toBeTruthy();
  });

  it('dit « Aucun compte ne correspond » quand la réponse est vide', async () => {
    const user = userEvent.setup();
    renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [] })));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'inconnu@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Aucun compte ne correspond')).toBeTruthy();
  });

  it('refuse une saisie invalide sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const { requests } = renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [] })));

    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Saisissez une adresse e-mail.')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Saisissez une adresse e-mail complète.')).toBeTruthy();
    expect(accountRequests(requests)).toHaveLength(0);
  });

  it('signale la limitation 429 (30 recherches par minute) avec le délai', async () => {
    const user = userEvent.setup();
    renderPlatform(<ComptesScreen />, searching(() => json(429, problem(429, 'too_many_requests', 'Trop de requêtes.'), { 'Retry-After': '20' })));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Trop de requêtes')).toBeTruthy();
    expect(screen.getByText(/Réessayez dans 20 s/)).toBeTruthy();
  });

  it('explique le refus 403 par le rôle', async () => {
    const user = userEvent.setup();
    renderPlatform(<ComptesScreen />, searching(() => json(403, roleRequired)));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Accès réservé')).toBeTruthy();
  });

  it('propose Réessayer après une panne puis affiche le résultat', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderPlatform(
      <ComptesScreen />,
      searching(() => {
        calls += 1;
        return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, { data: [accountSummary()] });
      }),
    );

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 3000 }));

    expect(await screen.findByRole('link', { name: 'Jeanne Martin' })).toBeTruthy();
  });

  it('refuse un résultat de plus d’un compte (hors contrat)', async () => {
    const user = userEvent.setup();
    renderPlatform(<ComptesScreen />, searching(() => json(200, { data: [accountSummary(), accountSummary({ id: IDS.second })] })));

    await user.type(screen.getByRole('textbox', { name: 'Adresse e-mail exacte' }), 'jeanne@exemple.fr');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText(/Réponse inattendue du serveur/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Jeanne Martin' })).toBeNull();
  });
});
