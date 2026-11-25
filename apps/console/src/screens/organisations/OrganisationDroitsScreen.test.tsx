import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { IDS, approvalData, problem, proofRequired, roleRequired } from '@/platform/fixtures';
import { entitlementsView, organisationDetail } from '@/platform/organisations/fixtures';
import { OrganisationDroitsScreen } from './OrganisationDroitsScreen';
import { consolePath, withOperator } from './testSupport';

interface Setup {
  roles?: string[];
  organisation?: () => Response;
  entitlements?: () => Response;
  approvals?: (request: RecordedRequest) => Response;
}

function open({ roles, organisation, entitlements, approvals }: Setup = {}) {
  return renderPlatform(
    <OrganisationDroitsScreen id={IDS.org} />,
    withOperator({ roles }, (request) => {
      const path = consolePath(request);
      if (request.method === 'GET' && path === `/organizations/${IDS.org}`) return (organisation ?? (() => json(200, { data: organisationDetail() })))();
      if (request.method === 'GET' && path === `/organizations/${IDS.org}/entitlements`) return (entitlements ?? (() => json(200, entitlementsView())))();
      if (request.method === 'POST' && path === '/approvals') return (approvals ?? (() => json(201, { data: approvalData() })))(request);
      return undefined;
    }),
  );
}

const futureDate = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

describe('modules d’une organisation (mode API)', () => {
  it('affiche les droits effectifs et les dérogations, avec retour à la fiche', async () => {
    const view = open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Modules de l’organisation' })).toBeTruthy();
    const rights = await screen.findByRole('table', { name: 'Droits de l’organisation' });
    expect(within(rights).getByRole('row', { name: /Lots.*Quota.*50.*Plan/ })).toBeTruthy();
    expect(within(rights).getByRole('row', { name: /Rapprochement bancaire.*Non incluse/ })).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Dérogations de l’organisation' })).getByText('En vigueur')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à la fiche' }).getAttribute('href')).toBe(`/organisations/${IDS.org}`);
    expect(screen.getByRole('link', { name: 'Agence du Port' }).getAttribute('href')).toBe(`/organisations/${IDS.org}`);
    await expectNoA11yViolations(view.container);
  });

  it('indique « Aucun abonnement » quand l’organisation n’a pas de droits (404 subscription_not_found)', async () => {
    open({ entitlements: () => json(404, problem(404, 'subscription_not_found', 'Cette organisation n’a pas d’abonnement.')) });

    expect(await screen.findByText(/Aucun abonnement/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('présente une organisation introuvable avec un retour à la liste', async () => {
    open({ organisation: () => json(404, problem(404, 'organization_not_found', 'Organisation introuvable.')) });

    expect(await screen.findByRole('heading', { name: 'Organisation introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux organisations' }).getAttribute('href')).toBe('/organisations');
  });

  it('affiche le refus 403 des droits et l’erreur serveur avec reprise', async () => {
    const forbidden = open({ entitlements: () => json(403, roleRequired) });
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    forbidden.unmount();

    const user = userEvent.setup();
    let calls = 0;
    open({
      entitlements: () => {
        calls += 1;
        return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, entitlementsView());
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 4000 }));
    expect(await screen.findByRole('table', { name: 'Droits de l’organisation' })).toBeTruthy();
  });

  it('affiche un loader pendant le chargement', () => {
    open();

    expect(screen.getByRole('status', { name: /Chargement/ })).toBeTruthy();
  });

  it('ne propose aucune demande à un rôle sans facturation', async () => {
    open({ roles: ['support'] });
    await screen.findByRole('table', { name: 'Droits de l’organisation' });
    await waitFor(() => { expect(screen.queryByRole('button', { name: 'Demander une dérogation' })).toBeNull(); });
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull();
  });

  it('dépose une demande de dérogation avec le code 2FA réclamé par le serveur', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const view = open({
      roles: ['billing'],
      approvals: () => {
        calls += 1;
        return calls === 1 ? json(422, proofRequired) : json(201, { data: approvalData() });
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Demander une dérogation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Demander une dérogation de droits' });
    await user.click(within(dialog).getByRole('combobox', { name: /^Fonction/ }));
    await user.click(await screen.findByRole('option', { name: /Lots/ }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Limite/ }), '60');
    fireEvent.change(within(dialog).getByLabelText('Fin de la dérogation'), { target: { value: futureDate() } });
    await user.click(within(dialog).getByRole('radio', { name: 'Geste commercial' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Geste suite à l’incident de mars.');
    await user.click(within(dialog).getByRole('button', { name: 'Demander la dérogation' }));

    await user.type(await screen.findByRole('textbox', { name: 'Code de double authentification' }), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Demande déposée')).toBeTruthy();
    const writes = view.writes();
    expect(writes).toHaveLength(2);
    expect(writes[0]?.body).not.toHaveProperty('two_factor_code');
    expect(writes[1]?.body).toMatchObject({ action: 'subscriptions.override.grant', subject_id: IDS.org, two_factor_code: '123456' });
  });

  it('affiche le refus 403 d’une demande de dérogation dans la fenêtre', async () => {
    const user = userEvent.setup();
    open({ roles: ['billing'], approvals: () => json(403, roleRequired) });
    await user.click(await screen.findByRole('button', { name: 'Demander une dérogation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Demander une dérogation de droits' });
    await user.click(within(dialog).getByRole('combobox', { name: /^Fonction/ }));
    await user.click(await screen.findByRole('option', { name: /Lots/ }));
    fireEvent.change(within(dialog).getByLabelText('Fin de la dérogation'), { target: { value: futureDate() } });
    await user.click(within(dialog).getByRole('radio', { name: 'Geste commercial' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Motif' }), 'Geste suite à l’incident de mars.');
    await user.click(within(dialog).getByRole('button', { name: 'Demander la dérogation' }));

    expect(await within(dialog).findByText(roleRequired.detail)).toBeTruthy();
    expect(screen.queryByText('Demande déposée')).toBeNull();
  });
});
