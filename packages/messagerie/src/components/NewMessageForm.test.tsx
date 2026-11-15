import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, pdf, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { conversationListSchema } from '../data/schemas';
import { NewMessageForm } from './NewMessageForm';

describe('NewMessageForm', () => {
  it('locataire : destinataire unique verrouillé, validation puis envoi et redirection', async () => {
    const { container, source, navigate } = renderMessagerie(<NewMessageForm />);
    const recipient = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Destinataire' });
    expect(recipient.readOnly).toBe(true);
    expect(recipient.value).toBe('Gestion Les Tilleuls');
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Saisissez un sujet')).toBeTruthy();
    expect(screen.getByText('Saisissez votre message')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox', { name: 'Sujet' }), 'Virement de novembre');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Le virement part demain.');
    await userEvent.upload(screen.getByLabelText('Choisir des fichiers'), pdf('preuve.pdf'));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => { expect(navigate).toHaveBeenCalledOnce(); });
    const list = conversationListSchema.parse(await source.listConversations({ tab: 'all', search: '', page: 1, pageSize: 50 }));
    const created = list.items.find((item) => item.subject === 'Virement de novembre');
    expect(created?.hasAttachments).toBe(true);
    expect(navigate).toHaveBeenCalledWith(`/messages/${created?.id ?? ''}`);
  });

  it('agence : propose de créer une campagne pour plusieurs destinataires, pas le locataire', async () => {
    const agence = renderMessagerie(<NewMessageForm />, { space: 'agence' });
    const link = await screen.findByRole('link', { name: 'Créer une campagne' });
    expect(link.getAttribute('href')).toBe('/messages/campagnes/nouvelle');
    agence.unmount();
    renderMessagerie(<NewMessageForm />);
    await screen.findByRole('textbox', { name: 'Destinataire' });
    expect(screen.queryByRole('link', { name: 'Créer une campagne' })).toBeNull();
  });

  it('agence : le destinataire est obligatoire, le rattachement suit le destinataire', async () => {
    const { navigate } = renderMessagerie(<NewMessageForm />, { space: 'agence' });
    await screen.findByRole('combobox', { name: /Destinataire/ });
    expect(screen.queryByRole('combobox', { name: /Rattaché à/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Choisissez un destinataire')).toBeTruthy();

    await userEvent.click(screen.getByRole('combobox', { name: /Destinataire/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Marc Chevalier/ }));
    await userEvent.click(await screen.findByRole('combobox', { name: /Rattaché à/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Mandat M-2025-0142/ }));

    await userEvent.type(screen.getByRole('textbox', { name: 'Sujet' }), 'Devis plomberie');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Le devis est joint.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledOnce(); });
  });

  it('affiche l’erreur de la source sans rediriger', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    const { navigate } = renderMessagerie(<NewMessageForm />, { source: brokenSource(base, ['createConversation']) });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Sujet' }), 'Sujet');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Texte');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Service indisponible');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('affiche l’erreur de chargement des destinataires', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<NewMessageForm />, { source: brokenSource(base, ['listRecipients']) });
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les destinataires.');
  });

  it('Annuler revient à la boîte de réception', async () => {
    const { navigate } = renderMessagerie(<NewMessageForm />);
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/messages');
  });
});
