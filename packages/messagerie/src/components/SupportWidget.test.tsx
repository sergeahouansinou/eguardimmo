import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { ticketSummarySchema } from '../data/schemas';
import { SupportWidget } from './SupportWidget';

const bubble = () => screen.getByRole('button', { name: 'Aide et support' });
const SATURDAY = new Date('2026-11-14T10:00:00+01:00');

describe('SupportWidget', () => {
  it('affiche la bulle puis le panneau avec l’état en ligne et la FAQ filtrable', async () => {
    renderMessagerie(<SupportWidget />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(bubble());
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    expect(await within(panel).findByText('En ligne')).toBeTruthy();
    expect(within(panel).getByText(/Réponse en général sous 2 heures/)).toBeTruthy();
    await within(panel).findByRole('button', { name: 'Comment payer mon loyer ?' });
    await userEvent.type(within(panel).getByRole('searchbox', { name: 'Rechercher dans l’aide' }), 'depot');
    expect(within(panel).queryByRole('button', { name: 'Comment payer mon loyer ?' })).toBeNull();
    expect(within(panel).getByRole('button', { name: /dépôt de garantie/ })).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Ouvrir le centre d’aide' }).getAttribute('href')).toBe('/aide');
    await expectNoA11yViolations(panel);
  });

  it('indique hors ligne en dehors des horaires', async () => {
    renderMessagerie(<SupportWidget />, { now: SATURDAY });
    await userEvent.click(bubble());
    expect(await screen.findByText('Hors ligne')).toBeTruthy();
  });

  it('crée une demande : le ticket et son fil s’ouvrent dans Mes demandes, puis réponse', async () => {
    const { source } = renderMessagerie(<SupportWidget />);
    await userEvent.click(bubble());
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Contacter' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Envoyer au support' }));
    expect(await within(panel).findByText('Saisissez un sujet')).toBeTruthy();

    await userEvent.type(within(panel).getByRole('textbox', { name: 'Sujet' }), 'Quittance manquante');
    await userEvent.type(within(panel).getByRole('textbox', { name: 'Message' }), 'Je ne la vois pas.');
    await userEvent.click(within(panel).getByRole('button', { name: 'Envoyer au support' }));

    expect(await within(panel).findByRole('heading', { name: 'Quittance manquante' })).toBeTruthy();
    expect(within(panel).getByRole('tab', { name: 'Mes demandes' }).getAttribute('aria-selected')).toBe('true');
    expect(within(panel).getByText(/Merci, votre demande SUP-/)).toBeTruthy();
    expect(within(panel).getByRole('list', { name: 'Échanges avec le support' }).querySelectorAll('article')).toHaveLength(2);

    await userEvent.type(within(panel).getByRole('textbox', { name: 'Votre message' }), 'Merci de votre retour.');
    await userEvent.click(within(panel).getByRole('button', { name: 'Répondre' }));
    expect(await within(panel).findByText('Merci de votre retour.')).toBeTruthy();

    const mine = z.array(ticketSummarySchema).parse(await source.listMyTickets());
    expect(mine[0]?.subject).toBe('Quittance manquante');
    expect(mine[0]?.messageCount).toBe(3);

    await userEvent.click(within(panel).getByRole('button', { name: 'Mes demandes' }));
    const list = await within(panel).findByRole('list', { name: 'Mes demandes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('historique : ouvre une demande résolue, sans note interne, et la rouvre en répondant', async () => {
    renderMessagerie(<SupportWidget />);
    await userEvent.click(bubble());
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Mes demandes' }));
    await userEvent.click(await within(panel).findByRole('button', { name: /Je ne retrouve pas mes documents/ }));
    expect(await within(panel).findByText('Résolu')).toBeTruthy();
    expect(within(panel).queryByText(/filtre d’année réinitialisé/)).toBeNull();
    await userEvent.type(within(panel).getByRole('textbox', { name: 'Votre message' }), 'Le problème est revenu.');
    await userEvent.click(within(panel).getByRole('button', { name: 'Répondre' }));
    await waitFor(() => { expect(within(panel).getByText('Ouvert')).toBeTruthy(); });
  });

  it('affiche l’état vide de l’historique et mène au formulaire', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<SupportWidget />, { source: { ...base, listMyTickets: () => Promise.resolve([]) } });
    await userEvent.click(bubble());
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Mes demandes' }));
    expect(await within(panel).findByText('Aucune demande pour le moment')).toBeTruthy();
    await userEvent.click(within(panel).getByRole('button', { name: 'Contacter le support' }));
    expect(within(panel).getByRole('form', { name: 'Contacter le support' })).toBeTruthy();
  });

  it('signale les erreurs de chargement et d’envoi', async () => {
    const base = createDemoMessagerieSource({ space: 'locataire', now: () => FIXED_NOW });
    renderMessagerie(<SupportWidget />, { source: brokenSource(base, ['listMyTickets', 'createSupportTicket']) });
    await userEvent.click(bubble());
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Mes demandes' }));
    expect((await within(panel).findByRole('alert')).textContent).toContain('Impossible de charger vos demandes.');
    await userEvent.click(within(panel).getByRole('tab', { name: 'Contacter' }));
    await userEvent.type(within(panel).getByRole('textbox', { name: 'Sujet' }), 'Sujet');
    await userEvent.type(within(panel).getByRole('textbox', { name: 'Message' }), 'Texte');
    await userEvent.click(within(panel).getByRole('button', { name: 'Envoyer au support' }));
    expect((await within(panel).findByRole('alert')).textContent).toContain('Service indisponible');
  });

  it('se ferme avec le bouton Fermer', async () => {
    renderMessagerie(<SupportWidget />);
    await userEvent.click(bubble());
    await userEvent.click(await screen.findByRole('button', { name: 'Fermer l’aide' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('n’apparaît pas dans la console, qui n’ouvre pas de ticket vers elle-même', () => {
    renderMessagerie(<SupportWidget />, { space: 'console' });
    expect(screen.queryByRole('button', { name: 'Aide et support' })).toBeNull();
  });
});
