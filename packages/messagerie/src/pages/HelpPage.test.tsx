import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { ticketSummarySchema } from '../data/schemas';
import { HelpPage } from './HelpPage';

describe('HelpPage', () => {
  it('locataire : catégories, contact, urgences et liens', async () => {
    const { container } = renderMessagerie(<HelpPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Aide' })).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Contacter le gestionnaire' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'En cas d’urgence' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Écrire un message' }).getAttribute('href')).toBe('/messages/nouveau');
    await expectNoA11yViolations(container);
  });

  it('déplie une réponse et affiche son lien', async () => {
    renderMessagerie(<HelpPage />);
    const question = await screen.findByRole('button', { name: 'Comment payer mon loyer ?' });
    expect(question.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Ouvrir Loyers et quittances' }).getAttribute('href')).toBe('/loyers');
    await userEvent.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('false');
  });

  it('recherche sans tenir compte des accents puis affiche l’état vide', async () => {
    renderMessagerie(<HelpPage />);
    await screen.findByRole('button', { name: 'Comment payer mon loyer ?' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher dans l’aide' }), 'conge');
    expect(screen.getAllByRole('button', { name: /congé/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Comment payer mon loyer ?' })).toBeNull();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher dans l’aide' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher dans l’aide' }), 'zzzz');
    expect(screen.getByText('Aucune réponse ne correspond')).toBeTruthy();
  });

  it('écrit au support : validation, création du ticket et confirmation', async () => {
    const { source } = renderMessagerie(<HelpPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Écrire au support' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer au support' }));
    expect(await within(dialog).findByText('Saisissez un sujet')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Sujet' }), 'Quittance manquante');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Message' }), 'Je ne vois pas la quittance de novembre.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer au support' }));
    expect(await within(dialog).findByText('Demande envoyée')).toBeTruthy();
    const mine = z.array(ticketSummarySchema).parse(await source.listMyTickets());
    expect(mine.some((ticket) => ticket.subject === 'Quittance manquante')).toBe(true);
    await userEvent.click(within(dialog).getByText('Fermer', { selector: 'button' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('console : pas de ticket vers le support, procédures et astreinte', async () => {
    renderMessagerie(<HelpPage />, { space: 'console' });
    expect(await screen.findByRole('button', { name: /File d’envoi saturée/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Astreinte' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Écrire au support' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'En cas d’urgence' })).toBeNull();
  });

  it('affiche l’erreur de chargement', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<HelpPage />, { source: brokenSource(base, ['helpCenter']) });
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger l’aide.');
  });
});
