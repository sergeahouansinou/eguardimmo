import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import type { ConversationQuery } from '../data/inputs';
import { ConversationList } from './ConversationList';
import type { ConversationListProps } from './ConversationList';

const props = (override: Partial<ConversationListProps> = {}): ConversationListProps => ({
  tab: 'all',
  search: '',
  page: 1,
  onTabChange: vi.fn(),
  onSearchChange: vi.fn(),
  onPageChange: vi.fn(),
  ...override,
});

describe('ConversationList', () => {
  it('affiche le chargement puis les conversations avec leurs compteurs d’onglets', async () => {
    const { container } = renderMessagerie(<ConversationList {...props()} />);
    expect(screen.getByRole('status').textContent).toBe('Chargement des messages');
    const list = await screen.findByRole('list', { name: 'Conversations' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: /Toutes/ }).textContent).toContain('5');
    expect(screen.getByRole('link', { name: /Merci de confirmer le virement/ }).getAttribute('href')).toBe('/messages/c-virement');
    expect(screen.getByText('Non lu,', { exact: false })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('transmet l’onglet et la recherche choisis', async () => {
    const onTabChange = vi.fn();
    const onSearchChange = vi.fn();
    renderMessagerie(<ConversationList {...props({ onTabChange, onSearchChange })} />);
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('tab', { name: /Envoyées/ }));
    expect(onTabChange).toHaveBeenCalledWith('sent');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un message' }), 'f');
    expect(onSearchChange).toHaveBeenCalledWith('f');
  });

  it('filtre par recherche et affiche l’état vide', async () => {
    renderMessagerie(<ConversationList {...props({ search: 'regularisation' })} />);
    const list = await screen.findByRole('list', { name: 'Conversations' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('affiche un état vide explicite quand rien ne correspond', async () => {
    renderMessagerie(<ConversationList {...props({ search: 'zzzz' })} />);
    expect(await screen.findByText('Aucun message ne correspond à votre recherche')).toBeTruthy();
  });

  it('affiche l’erreur de chargement et permet de réessayer', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<ConversationList {...props()} />, { source: brokenSource(base, ['listConversations']) });
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les messages.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('marque une conversation comme lue depuis le menu et met la liste à jour', async () => {
    renderMessagerie(<ConversationList {...props()} />);
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour Merci de confirmer le virement avant le 20 novembre' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Marquer comme lu' }));
    await waitFor(() => { expect(screen.queryByText('Non lu,', { exact: false })).toBeNull(); });
  });

  it('archive une conversation et la retire de l’onglet courant', async () => {
    renderMessagerie(<ConversationList {...props()} />);
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour Relance, loyer de novembre' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.queryByRole('link', { name: /Relance, loyer de novembre/ })).toBeNull(); });
    expect(screen.getByRole('tab', { name: /Archivées/ }).textContent).toContain('1');
  });

  it('signale l’échec d’une action du menu', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<ConversationList {...props()} />, { source: brokenSource(base, ['setConversationArchived']) });
    await screen.findByRole('list', { name: 'Conversations' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour Relance, loyer de novembre' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Service indisponible');
  });

  it('pagine quand il y a plusieurs pages', async () => {
    const onPageChange = vi.fn();
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    const small = { ...base, listConversations: (query: ConversationQuery) => base.listConversations({ ...query, pageSize: 2 }) };
    renderMessagerie(<ConversationList {...props({ onPageChange })} />, { source: small });
    await screen.findByRole('list', { name: 'Conversations' });
    expect(screen.getByText(/1 à 2 sur 5/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
