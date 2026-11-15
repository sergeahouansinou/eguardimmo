import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { conversationListSchema } from '../data/schemas';
import { ConversationPage } from './ConversationPage';
import { InboxPage } from './InboxPage';
import { NewMessagePage } from './NewMessagePage';

describe('InboxPage', () => {
  it('locataire : titre, lien Nouveau message, onglets et pas de campagnes', async () => {
    const { container } = renderMessagerie(<InboxPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Messages' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nouveau message' }).getAttribute('href')).toBe('/messages/nouveau');
    expect(screen.queryByRole('link', { name: 'Campagnes' })).toBeNull();
    await screen.findByRole('list', { name: 'Conversations' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent.replace(/\d+$/, ''))).toEqual(['Toutes', 'À répondre', 'Envoyées', 'Archivées']);
    await expectNoA11yViolations(container);
  });

  it('locataire : l’onglet À répondre filtre la liste', async () => {
    renderMessagerie(<InboxPage />);
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('tab', { name: /À répondre/ }));
    await waitFor(() => {
      expect(within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole('listitem')).toHaveLength(1);
    });
  });

  it('agence : indicateurs, lien campagnes, onglet Mandants et recherche', async () => {
    renderMessagerie(<InboxPage />, { space: 'agence' });
    expect(screen.getByRole('link', { name: 'Campagnes' }).getAttribute('href')).toBe('/messages/campagnes');
    expect(await screen.findByRole('region', { name: 'Messages non lus' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sans réponse' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Délai moyen de réponse' })).toBeTruthy();
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('tab', { name: /Mandants/ }));
    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThan(9);
    });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un message' }), 'zzzz');
    expect(await screen.findByText('Aucun message ne correspond à votre recherche')).toBeTruthy();
  });

  it('agence : une erreur d’indicateurs ne masque pas la liste', async () => {
    const base = createDemoMessagerieSource({ space: 'agence', now: () => FIXED_NOW });
    renderMessagerie(<InboxPage />, { space: 'agence', source: brokenSource(base, ['inboxStats']) });
    expect((await screen.findByText('Impossible de charger les indicateurs.'))).toBeTruthy();
    expect(await screen.findByRole('list', { name: 'Conversations' })).toBeTruthy();
  });
});

describe('ConversationPage', () => {
  it('affiche le fil, le contexte, les liens et marque la conversation comme lue', async () => {
    const { source, container } = renderMessagerie(<ConversationPage conversationId="c-virement" />);
    expect(await screen.findByRole('heading', { level: 1, name: /Merci de confirmer le virement/ })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Fil de la conversation' }).querySelectorAll('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Ouvrir mon bail' }).getAttribute('href')).toBe('/bail');
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages');
    await waitFor(async () => {
      const list = conversationListSchema.parse(await source.listConversations({ tab: 'unread', search: '', page: 1, pageSize: 50 }));
      expect(list.items.some((item) => item.id === 'c-virement')).toBe(false);
    });
    await expectNoA11yViolations(container);
  });

  it('envoie une réponse qui apparaît dans le fil', async () => {
    renderMessagerie(<ConversationPage conversationId="c-virement" />);
    await screen.findByRole('list', { name: 'Fil de la conversation' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre réponse' }), 'Virement effectué ce matin.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Virement effectué ce matin.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Fil de la conversation' }).querySelectorAll('article')).toHaveLength(4);
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Votre réponse' }).value).toBe('');
  });

  it('archive la conversation puis revient à la boîte de réception', async () => {
    const { navigate, source } = renderMessagerie(<ConversationPage conversationId="c-relance" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/messages'); });
    const archived = conversationListSchema.parse(await source.listConversations({ tab: 'archived', search: '', page: 1, pageSize: 50 }));
    expect(archived.items.map((item) => item.id)).toEqual(['c-relance']);
  });

  it('propose Désarchiver pour une conversation archivée', async () => {
    const { source } = renderMessagerie(<ConversationPage conversationId="c-relance" />);
    await source.setConversationArchived('c-relance', true);
    await userEvent.click(await screen.findByRole('button', { name: 'Désarchiver' }));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Archiver' })).toBeTruthy(); });
  });

  it('signale une conversation introuvable', async () => {
    renderMessagerie(<ConversationPage conversationId="inconnue" />);
    expect((await screen.findByRole('alert')).textContent).toContain('Conversation introuvable ou inaccessible.');
  });
});

describe('NewMessagePage', () => {
  it('affiche le fil d’Ariane et le formulaire', async () => {
    renderMessagerie(<NewMessagePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Nouveau message' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages');
    expect(await screen.findByRole('form', { name: 'Nouveau message' })).toBeTruthy();
  });
});
