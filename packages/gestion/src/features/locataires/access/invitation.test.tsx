import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import { InvitationPage } from './InvitationPage';
import * as fx from './api/responses.fixtures';
import { accessUrl, partiesUrl } from './api/testing';
import { renderAccess } from './testing';

const listRoute = { [`GET ${partiesUrl()}`]: { body: fx.partyPage } };

async function openAccess(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Gérer l’accès de ${name}` }));
}

describe('page d’invitation à l’espace locataire', () => {
  it('liste les personnes du serveur sans les contacts archivés et invite à choisir', async () => {
    const { container, callsTo } = renderAccess(<InvitationPage />, listRoute);

    const list = await screen.findByRole('list', { name: 'Contacts' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(norm(rows[0]?.textContent)).toContain('Danielle Martin');
    expect(norm(rows[0]?.textContent)).toContain('danielle.martin@example.com');
    expect(norm(rows[1]?.textContent)).toContain('Aucun e-mail principal');
    expect(screen.queryByText('Contact archivé')).toBeNull();
    expect(screen.getByText('Choisissez un contact')).toBeTruthy();
    expect(callsTo('GET', accessUrl())).toHaveLength(0);
    expect(document.body.textContent).not.toContain('Sophie Delmas');
    await expectNoA11yViolations(container);
  });

  it('cherche côté serveur avec le terme saisi', async () => {
    const { callsTo } = renderAccess(<InvitationPage />, listRoute);
    await screen.findByRole('list', { name: 'Contacts' });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un contact' }), 'dani');

    await waitFor(() => { expect(callsTo('GET', partiesUrl()).at(-1)?.search.get('q')).toBe('dani'); });
    expect(callsTo('GET', partiesUrl()).at(-1)?.search.get('kind')).toBe('person');
  });

  it('affiche l’état « aucune invitation » puis invite avec l’e-mail principal', async () => {
    let status: 'none' | 'invited' = 'none';
    const { container, callsTo } = renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl()}`]: () => ({ body: status === 'none' ? fx.accessNone : fx.accessInvited }),
      [`POST ${accessUrl()}`]: () => { status = 'invited'; return { status: 201, body: fx.accessInvited }; },
    });
    await openAccess('Danielle Martin');

    expect(await screen.findByText('Aucune invitation')).toBeTruthy();
    expect(screen.getByText('Ce contact n’a pas encore été invité à l’espace locataire.')).toBeTruthy();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Inviter à l’espace locataire' }));

    await waitFor(() => { expect(callsTo('POST', accessUrl())).toHaveLength(1); });
    expect(callsTo('POST', accessUrl())[0]?.body).toEqual({});
    expect(await screen.findByText('Invitation en attente')).toBeTruthy();
    expect(screen.getByText('Invitation envoyée à d***@example.com, valable jusqu’au 30/11/2026.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renvoyer l’invitation' })).toBeTruthy();
  });

  it('envoie l’adresse saisie et refuse une adresse invalide sans appeler le serveur', async () => {
    const { callsTo } = renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl(fx.IDS.partyNoEmail)}`]: { body: { data: { ...fx.accessNone.data, party_id: fx.IDS.partyNoEmail } } },
      [`POST ${accessUrl(fx.IDS.partyNoEmail)}`]: { status: 201, body: fx.accessInvited },
    });
    await openAccess('Yann Le Gall');
    await screen.findByText('Aucune invitation');

    await userEvent.type(screen.getByRole('textbox', { name: 'Adresse e-mail à inviter' }), 'pas-un-mail');
    await userEvent.click(screen.getByRole('button', { name: 'Inviter à l’espace locataire' }));
    expect(await screen.findByText('Saisissez une adresse e-mail valide.')).toBeTruthy();
    expect(callsTo('POST', accessUrl(fx.IDS.partyNoEmail))).toHaveLength(0);

    await userEvent.clear(screen.getByRole('textbox', { name: 'Adresse e-mail à inviter' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Adresse e-mail à inviter' }), 'yann@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Inviter à l’espace locataire' }));

    await waitFor(() => { expect(callsTo('POST', accessUrl(fx.IDS.partyNoEmail))[0]?.body).toEqual({ email: 'yann@example.com' }); });
  });

  it('renvoie une invitation en attente', async () => {
    const { callsTo } = renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl()}`]: { body: fx.accessInvited },
      [`POST ${accessUrl()}`]: { status: 201, body: fx.accessInvited },
    });
    await openAccess('Danielle Martin');

    await userEvent.click(await screen.findByRole('button', { name: 'Renvoyer l’invitation' }));

    await waitFor(() => { expect(callsTo('POST', accessUrl())).toHaveLength(1); });
    expect(await screen.findByText('Invitation renvoyée')).toBeTruthy();
  });

  it('révoque un accès actif après confirmation', async () => {
    let revoked = false;
    const { callsTo } = renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl()}`]: () => ({ body: revoked ? fx.accessNone : fx.accessLinked }),
      [`DELETE ${accessUrl()}`]: () => { revoked = true; return { status: 204 }; },
    });
    await openAccess('Danielle Martin');
    expect(await screen.findByText('Espace locataire actif')).toBeTruthy();
    expect(screen.getByText('Compte rattaché (d***@example.com) depuis le 10/11/2026.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inviter à l’espace locataire' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Révoquer l’accès' }));
    expect(callsTo('DELETE', accessUrl())).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Révoquer' }));

    await waitFor(() => { expect(callsTo('DELETE', accessUrl())).toHaveLength(1); });
    expect(await screen.findByText('Aucune invitation')).toBeTruthy();
  });

  it('affiche le message du serveur quand l’e-mail principal manque', async () => {
    renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl(fx.IDS.partyNoEmail)}`]: { body: { data: { ...fx.accessNone.data, party_id: fx.IDS.partyNoEmail } } },
      [`POST ${accessUrl(fx.IDS.partyNoEmail)}`]: { status: 422, body: fx.problemEmailRequired },
    });
    await openAccess('Yann Le Gall');
    await userEvent.click(await screen.findByRole('button', { name: 'Inviter à l’espace locataire' }));

    expect(await screen.findByText('Invitation impossible')).toBeTruthy();
    expect(screen.getAllByText('Ce contact n’a pas d’e-mail principal : indiquez l’adresse à inviter.').length).toBeGreaterThan(0);
  });

  it('signale un conflit de rattachement', async () => {
    renderAccess(<InvitationPage />, {
      ...listRoute,
      [`GET ${accessUrl()}`]: { body: fx.accessNone },
      [`POST ${accessUrl()}`]: { status: 409, body: fx.problemAlreadyLinked },
    });
    await openAccess('Danielle Martin');
    await userEvent.click(await screen.findByRole('button', { name: 'Inviter à l’espace locataire' }));

    expect(await screen.findByText('Ce contact est déjà rattaché à un compte : révoquez son accès avant d’en inviter un autre.')).toBeTruthy();
  });

  it('signale l’échec de lecture de l’accès et de la liste', async () => {
    renderAccess(<InvitationPage />, { ...listRoute, [`GET ${accessUrl()}`]: { status: 403, body: fx.problemForbidden } });
    await openAccess('Danielle Martin');
    expect(await screen.findByText('Votre rôle ne permet pas de gérer les invitations des locataires.')).toBeTruthy();
  });

  it('signale une liste de contacts indisponible', async () => {
    renderAccess(<InvitationPage />, { [`GET ${partiesUrl()}`]: { status: 503, body: { status: 503, code: 'service_unavailable', title: 'x', detail: 'x' } } });

    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
  });

  it('affiche l’état vide de la recherche', async () => {
    renderAccess(<InvitationPage />, { [`GET ${partiesUrl()}`]: { body: { ...fx.partyPage, data: [] } } });

    expect(await screen.findByText('Aucun contact')).toBeTruthy();
  });

  it('ne charge rien pour un rôle sans droit de gestion', async () => {
    const { calls, container } = renderAccess(<InvitationPage />, {}, { role: 'accountant' });

    expect(await screen.findByText('Invitations réservées à la gestion')).toBeTruthy();
    expect(calls).toHaveLength(0);
    await expectNoA11yViolations(container);
  });
});
