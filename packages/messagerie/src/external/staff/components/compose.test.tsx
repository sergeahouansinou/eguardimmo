import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { fakeStaffSource, renderStaff, staffDetailOf } from '../../../../test/staff';
import { NOT_A_NOTICE_TEXT } from '../../copy';
import { LEASE_ID, MANDATE_ID, OWNER_PARTY_ID, TENANT_ID, THREAD_ID } from '../testing';
import { StaffWriteButton } from './WriteButton';
import type { StaffWriteTarget } from './ComposeDialog';

const UUID = /^[0-9a-f-]{36}$/;
const SECOND_LEASE = '0193a5e1-0000-7000-8000-0000000001c9';
const tenant: StaffWriteTarget = { kind: 'tenant', partyId: TENANT_ID, partyName: 'Awa Koffi', links: [{ id: LEASE_ID, label: 'Bail BAIL-2026-001' }] };
const owner: StaffWriteTarget = { kind: 'owner', partyId: OWNER_PARTY_ID, partyName: 'Indivision Roux', links: [{ id: MANDATE_ID, label: 'Mandat MAN-7' }] };

async function fill(subject: string, body: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: /Objet/ }), subject);
  await user.type(screen.getByRole('textbox', { name: /Message/ }), body);
  return user;
}

describe('ouverture d’une conversation depuis une fiche', () => {
  it('ouvre un fil locataire avec le locataire, le bail de la fiche et un client_id, puis va au fil', async () => {
    const source = fakeStaffSource({ openThread: () => Promise.resolve(staffDetailOf()) });
    const { navigate, container } = renderStaff(<StaffWriteButton target={tenant} />, { source });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Écrire' }));
    const dialog = await screen.findByRole('dialog', { name: 'Écrire à Awa Koffi' });
    expect(within(dialog).getByDisplayValue('Bail BAIL-2026-001')).toBeTruthy();
    expect(within(dialog).getByText(NOT_A_NOTICE_TEXT)).toBeTruthy();
    await expectNoA11yViolations(container.ownerDocument.body);

    const user = await fill('Votre quittance', 'Elle est disponible.');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(source.openThread).toHaveBeenCalledTimes(1); });
    expect(source.openThread).toHaveBeenCalledWith({
      kind: 'tenant',
      partyId: TENANT_ID,
      leaseId: LEASE_ID,
      mandateId: null,
      subject: 'Votre quittance',
      body: 'Elle est disponible.',
      files: [],
      clientId: expect.stringMatching(UUID) as string,
    });
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/messages/fil/${THREAD_ID}`); });
  });

  it('ouvre un fil mandant avec le mandat de la fiche', async () => {
    const source = fakeStaffSource({ openThread: () => Promise.resolve(staffDetailOf({ kind: 'owner' })) });
    renderStaff(<StaffWriteButton target={{ ...owner, defaultLinkId: MANDATE_ID }} label="Écrire au mandant" />, { source });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Écrire au mandant' }));

    const user = await fill('Reversement', 'Il part demain.');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(source.openThread).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner', partyId: OWNER_PARTY_ID, mandateId: MANDATE_ID, leaseId: null })); });
  });

  it('exige le bail concerné quand la fiche en porte plusieurs, sans appeler le serveur', async () => {
    const source = fakeStaffSource();
    renderStaff(<StaffWriteButton target={{ ...tenant, links: [...(tenant.links ?? []), { id: SECOND_LEASE, label: 'Bail BAIL-2026-002' }] }} />, { source });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Écrire' }));

    const user = await fill('Objet', 'Texte');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Choisissez le bail concerné')).toBeTruthy();
    expect(source.openThread).not.toHaveBeenCalled();
  });

  it('refuse un objet et un message vides', async () => {
    const source = fakeStaffSource();
    renderStaff(<StaffWriteButton target={tenant} />, { source });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Écrire' }));
    await user.click(await screen.findByRole('button', { name: 'Envoyer' }));
    expect(source.openThread).not.toHaveBeenCalled();
    expect(await screen.findByText('Saisissez un sujet')).toBeTruthy();
    expect(screen.getByText('Saisissez votre message')).toBeTruthy();
  });

  it('rejoue le même client_id après une panne et n’en change qu’avec le contenu', async () => {
    const open = vi.fn().mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockResolvedValue(staffDetailOf());
    renderStaff(<StaffWriteButton target={tenant} />, { source: fakeStaffSource({ openThread: open }) });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Écrire' }));

    const user = await fill('Objet', 'Texte');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/enregistré qu’une seule fois/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => { expect(open).toHaveBeenCalledTimes(2); });
    await user.type(screen.getByRole('textbox', { name: /Message/ }), ' suite');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => { expect(open).toHaveBeenCalledTimes(3); });

    const ids = open.mock.calls.map((call: unknown[]) => (call[0] as { clientId: string }).clientId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it.each([
    [422, 'recipient_not_found', /pas de compte rattaché/],
    [404, 'conversation_link_not_found', /bail ou ce mandat/],
    [409, 'conversation_open_limit', /10 conversations ouvertes/],
    [403, 'role_forbidden', /Votre rôle ne permet pas/],
  ])('traduit le refus %i %s du serveur et garde la saisie', async (status, code, message) => {
    const source = fakeStaffSource({ openThread: () => Promise.reject(new ApiError(status, code, 'brut')) });
    renderStaff(<StaffWriteButton target={tenant} />, { source });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Écrire' }));

    const user = await fill('Objet', 'Texte');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /Message/ }).value).toBe('Texte');
  });
});

describe('visibilité du bouton « Écrire »', () => {
  it('est absent pour un comptable', () => {
    renderStaff(<StaffWriteButton target={tenant} />, { role: 'accountant' });
    expect(screen.queryByRole('button', { name: 'Écrire' })).toBeNull();
  });

  it('est présent pour un gestionnaire', () => {
    renderStaff(<StaffWriteButton target={tenant} />, { role: 'manager' });
    expect(screen.getByRole('button', { name: 'Écrire' })).toBeTruthy();
  });

  it('est absent côté mandant pour une organisation individuelle', () => {
    renderStaff(<StaffWriteButton target={owner} />, { organizationKind: 'individual' });
    expect(screen.queryByRole('button', { name: 'Écrire' })).toBeNull();
  });

  it('est absent pour un locataire sans bail', () => {
    renderStaff(<StaffWriteButton target={{ ...tenant, links: [] }} />);
    expect(screen.queryByRole('button', { name: 'Écrire' })).toBeNull();
  });
});
