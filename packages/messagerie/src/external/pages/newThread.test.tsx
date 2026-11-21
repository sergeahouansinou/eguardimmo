import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { detailOf, fakeSource, renderExternal } from '../../../test/external';
import { NOT_A_NOTICE_TEXT } from '../copy';
import type { ComposeOption } from '../model';
import { LEASE_ID, THREAD_ID } from '../testing';
import { ExternalNewThreadPage } from './NewThreadPage';

const tilleuls: ComposeOption = { id: LEASE_ID, agencyId: 'a1', agencyName: 'Agence des Tilleuls', label: 'Agence des Tilleuls · Bail BAIL-2026-001' };
const second: ComposeOption = { id: '0193a5e1-0000-7000-8000-0000000000c2', agencyId: 'a2', agencyName: 'Cabinet Delmas', label: 'Cabinet Delmas · Bail BAIL-2026-002' };

describe('nouvelle conversation externe', () => {
  it('verrouille le destinataire quand une seule option existe, envoie puis ouvre le fil', async () => {
    const source = fakeSource({ composeOptions: () => Promise.resolve([tilleuls]), openThread: () => Promise.resolve(detailOf()) });
    const { container, navigate } = renderExternal(<ExternalNewThreadPage />, { source });
    const user = userEvent.setup();

    const recipient = await screen.findByRole('textbox', { name: 'Bail concerné' });
    expect((recipient as HTMLInputElement).readOnly).toBe(true);
    expect((recipient as HTMLInputElement).value).toBe(tilleuls.label);
    expect(screen.getByText(NOT_A_NOTICE_TEXT)).toBeTruthy();
    await expectNoA11yViolations(container);

    await user.type(screen.getByRole('textbox', { name: 'Objet' }), 'Quittance');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Bonjour');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/messages/${THREAD_ID}`); });
    const input = source.openThread.mock.calls[0]?.[0];
    expect(input).toMatchObject({ optionId: LEASE_ID, subject: 'Quittance', body: 'Bonjour', files: [] });
    expect(input?.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('exige un choix quand plusieurs options existent et valide les champs sans appeler le serveur', async () => {
    const source = fakeSource({ composeOptions: () => Promise.resolve([tilleuls, second]) });
    renderExternal(<ExternalNewThreadPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(screen.getByRole('textbox', { name: 'Objet' }).getAttribute('aria-invalid')).toBe('true'); });
    expect(source.openThread).not.toHaveBeenCalled();
  });

  it('préselectionne l’option demandée dans le lien', async () => {
    const source = fakeSource({ composeOptions: () => Promise.resolve([tilleuls, second]) });
    renderExternal(<ExternalNewThreadPage initialOptionId={second.id} />, { source });

    expect((await screen.findByRole('combobox', { name: /Bail concerné/ })).textContent).toContain('Cabinet Delmas');
  });

  it('rejoue le même client_id après un échec réseau, sans navigation', async () => {
    const open = vi.fn().mockRejectedValueOnce(new ApiUnreachableError()).mockResolvedValueOnce(detailOf());
    const source = fakeSource({ composeOptions: () => Promise.resolve([tilleuls]), openThread: open });
    const { navigate } = renderExternal(<ExternalNewThreadPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Objet' }), 'Quittance');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Bonjour');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/enregistré qu’une seule fois/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const ids = open.mock.calls.map((call: unknown[]) => (call[0] as { clientId: string }).clientId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('affiche l’erreur de validation du serveur en français', async () => {
    const source = fakeSource({
      composeOptions: () => Promise.resolve([tilleuls]),
      openThread: () => Promise.reject(new ApiError(403, 'conversation_forbidden', 'brut')),
    });
    renderExternal(<ExternalNewThreadPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Objet' }), 'Quittance');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Bonjour');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    const alert = await screen.findByText('Envoi impossible');
    expect(alert).toBeTruthy();
    expect(screen.queryByText('brut')).toBeNull();
  });

  it('explique l’absence de destinataire quand aucune option n’est servie', async () => {
    const source = fakeSource({ composeOptions: () => Promise.resolve([]) });
    renderExternal(<ExternalNewThreadPage />, { source });

    expect(await screen.findByText('Aucun bail ne permet d’écrire pour le moment')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Nouveau message' })).toBeNull();
  });

  it('propose de réessayer quand les destinataires ne se chargent pas', async () => {
    const source = fakeSource({ composeOptions: () => Promise.reject(new ApiError(503, 'x', 'brut')) });
    renderExternal(<ExternalNewThreadPage />, { source });

    expect(await screen.findByText('Impossible de charger vos destinataires.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
