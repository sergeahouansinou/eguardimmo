import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../test/axe';
import { renderMessagerie } from '../test/render';
import type { MessagerieSpace } from './data/demo';
import { ConversationPage } from './pages/ConversationPage';
import { HelpPage } from './pages/HelpPage';
import { InboxPage } from './pages/InboxPage';
import { NewMessagePage } from './pages/NewMessagePage';

const clientSpaces: { space: MessagerieSpace; tabs: string[] }[] = [
  { space: 'locataire', tabs: ['Toutes', 'À répondre', 'Envoyées', 'Archivées'] },
  { space: 'proprietaire', tabs: ['Toutes', 'Non lues', 'Archivées'] },
  { space: 'agence', tabs: ['Tous', 'Non lus', 'Mandants', 'Locataires', 'Archivés'] },
  { space: 'bailleur', tabs: ['Reçus', 'Non lus', 'Envoyés', 'Archivés'] },
];

describe.each(clientSpaces)('espace $space', ({ space, tabs }) => {
  it('la boîte de réception affiche ses onglets propres et une liste accessible', async () => {
    const { container } = renderMessagerie(<InboxPage />, { space });
    const list = await screen.findByRole('list', { name: 'Conversations' });
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent.replace(/\d+$/, ''))).toEqual(tabs);
    await expectNoA11yViolations(container);
  });

  it('le formulaire de nouveau message et l’aide se chargent sans erreur', async () => {
    const first = renderMessagerie(<NewMessagePage />, { space });
    expect(await screen.findByRole('form', { name: 'Nouveau message' })).toBeTruthy();
    await expectNoA11yViolations(first.container);
    first.unmount();
    const second = renderMessagerie(<HelpPage />, { space });
    expect((await screen.findAllByRole('heading', { level: 2 })).length).toBeGreaterThan(0);
    await expectNoA11yViolations(second.container);
  });

  it('ouvre une conversation de la liste', async () => {
    const first = renderMessagerie(<InboxPage />, { space });
    const list = await screen.findByRole('list', { name: 'Conversations' });
    const href = list.querySelector('a')?.getAttribute('href') ?? '';
    expect(href.startsWith('/messages/')).toBe(true);
    first.unmount();
    renderMessagerie(<ConversationPage conversationId={href.replace('/messages/', '')} />, { space });
    expect(await screen.findByRole('list', { name: 'Fil de la conversation' })).toBeTruthy();
  });
});
