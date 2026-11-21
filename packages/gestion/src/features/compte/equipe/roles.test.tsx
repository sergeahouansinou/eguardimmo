import { createApiClient } from '@eguardimmo/api';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { renderScreen, screenProps } from '../shared/testing';
import { createApiEquipeSource } from './api';
import { EquipeInvitePage } from './EquipeInvitePage';
import { EquipeRolesPage } from './RolesPage';
import { demoTeam } from './demo';
import { ROLE_MATRIX_ROWS, rolesResponse } from './roles.fixtures';
import { EquipeSourceProvider, createDemoEquipeSource } from './source';

const ORG = '01934f6e-0000-7000-8000-00000000000a';

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function apiSource(handler: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(() => Promise.resolve(handler()));
  const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl, readCookie: () => 'xsrf' });
  const source = { ...createDemoEquipeSource({ ...demoTeam, seatLimit: null }), getRoles: createApiEquipeSource(client, ORG).getRoles };
  return { source, fetchImpl };
}

function renderRoles(source: ReturnType<typeof apiSource>['source']) {
  return renderScreen(
    <EquipeSourceProvider source={source}>
      <EquipeRolesPage {...screenProps} />
    </EquipeSourceProvider>,
  );
}

describe('page Rôles et droits branchée sur GET /roles', () => {
  it('affiche la matrice du serveur, la colonne du rôle courant et la légende', async () => {
    const { source } = apiSource(() => reply(200, rolesResponse('manager')));
    const { container } = renderRoles(source);

    const table = await screen.findByRole('table', { name: 'Matrice des droits par rôle' });
    expect(within(table).getAllByRole('row')).toHaveLength(ROLE_MATRIX_ROWS.length + 1);
    expect(within(table).getByRole('columnheader', { name: /Gestionnaire \(vous\)/ })).toBeTruthy();
    const banking = within(table).getByText('Banque et rapprochement').closest('tr');
    expect(banking).not.toBeNull();
    expect(within(banking as HTMLElement).getAllByRole('cell').slice(1).map((cell) => cell.textContent)).toEqual(['Modifier, 2FA', 'Modifier, 2FA', 'Aucun', 'Modifier, 2FA']);
    expect(screen.getByText(/Votre rôle : Gestionnaire/)).toBeTruthy();
    expect(screen.getByText(/n'est pas appliqué/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Légende des niveaux' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Inviter un membre/ }).getAttribute('href')).toBe('/equipe/inviter');
    await expectNoA11yViolations(container);
  });

  it('annonce le chargement avant la réponse du serveur', async () => {
    let release: (response: Response) => void = () => undefined;
    const { source } = apiSource(() => new Promise<Response>((resolve) => { release = resolve; }));
    renderRoles(source);

    expect(await screen.findByRole('status', { name: 'Chargement des droits' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    release(reply(200, rolesResponse()));
    expect(await screen.findByRole('table', { name: 'Matrice des droits par rôle' })).toBeTruthy();
  });

  it('affiche l’erreur avec « Réessayer », qui recharge la matrice', async () => {
    let failing = true;
    const { source, fetchImpl } = apiSource(() => (failing ? reply(500, { code: 'server_error', title: 'Erreur', status: 500 }) : reply(200, rolesResponse())));
    renderRoles(source);

    expect(await screen.findByText("Les droits des rôles n'ont pas pu être chargés")).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table', { name: 'Matrice des droits par rôle' })).toBeTruthy();
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche un état vide quand le serveur ne renvoie aucun domaine', async () => {
    const { source } = apiSource(() => reply(200, { data: { current_role: 'owner', domains: [] } }));
    renderRoles(source);

    expect(await screen.findByText('Aucun droit à afficher')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('droits du rôle choisi à l’invitation', () => {
  it('résume les domaines principaux depuis le serveur et suit le rôle choisi', async () => {
    const { source } = apiSource(() => reply(200, rolesResponse()));
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );

    const rights = await screen.findByRole('region', { name: 'Droits du rôle' });
    await waitFor(() => { expect(within(rights).getAllByRole('listitem')).toHaveLength(8); });
    const sensitive = () => within(rights).getByText('Reversements : validation, exécution, apports, clôture, export').closest('li') as HTMLElement;
    expect(within(sensitive()).getByText('Modifier, 2FA')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Gestionnaire/ }));
    expect(within(sensitive()).getByText('Aucun')).toBeTruthy();
    expect(within(rights).getByRole('link', { name: 'Voir tous les droits' }).getAttribute('href')).toBe('/equipe/roles');
  });

  it('affiche l’erreur de chargement des droits sans bloquer le formulaire', async () => {
    const { source } = apiSource(() => reply(500, { code: 'server_error', title: 'Erreur', status: 500 }));
    renderScreen(
      <EquipeSourceProvider source={source}>
        <EquipeInvitePage {...screenProps} />
      </EquipeSourceProvider>,
    );

    expect(await screen.findByText("Les droits des rôles n'ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByRole('button', { name: "Envoyer l'invitation" }).hasAttribute('disabled')).toBe(false);
  });
});

describe('matrice de démonstration', () => {
  it('reste servie par la source de démonstration seulement', async () => {
    const matrix = await createDemoEquipeSource().getRoles();

    expect(matrix.currentRole).toBe('administrateur');
    expect(matrix.domains.map((domain) => domain.label)).toContain('Reversements, banque, clôture');
    expect(matrix.domains.every((domain) => domain.highlighted)).toBe(true);
  });
});
