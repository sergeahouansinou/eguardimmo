import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { FIXED_NOW, brokenSource, renderMessagerie } from '../../test/render';
import { createDemoMessagerieSource } from '../data/demo';
import { ticketDetailSchema } from '../data/schemas';
import { SupportBoardPage, TicketPage } from './SupportPages';

const rows = () => within(screen.getByRole('list', { name: 'Tickets' })).getAllByRole('listitem');

describe('SupportBoardPage', () => {
  it('affiche les indicateurs, les onglets et les tickets ouverts avec lien vers le détail', async () => {
    const { container } = renderMessagerie(<SupportBoardPage />, { space: 'console' });
    await screen.findByRole('list', { name: 'Tickets' });
    expect(screen.getByRole('region', { name: 'Tickets ouverts' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Première réponse' }).textContent).toContain('2 h 10');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent.replace(/\d+$/, ''))).toEqual(['Ouverts', 'En attente', 'Résolus', 'Tous']);
    expect(screen.getByRole('link', { name: /E-mails de relance non reçus/ }).getAttribute('href')).toBe('/support/tk-2094');
    await expectNoA11yViolations(container);
  });

  it('change d’onglet et filtre par recherche, priorité et assignation', async () => {
    renderMessagerie(<SupportBoardPage />, { space: 'console' });
    await screen.findByRole('list', { name: 'Tickets' });
    const allTab = screen.getByRole('tab', { name: /Tous/ });
    const total = Number(within(allTab).getByText(/^\d+$/).textContent);
    await userEvent.click(allTab);
    await waitFor(() => { expect(rows()).toHaveLength(total); });

    await userEvent.click(screen.getByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Haute' }));
    await waitFor(() => { expect(rows().length).toBeLessThan(total); });
    for (const row of rows()) expect(row.textContent).toContain('Priorité haute');

    await userEvent.click(screen.getByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Toutes priorités' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Assignation/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Non assignés' }));
    await waitFor(() => {
      for (const row of rows()) expect(row.textContent).toContain('Non assigné');
    });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un ticket' }), 'zzzz');
    expect(await screen.findByText('Aucun ticket ne correspond')).toBeTruthy();
  });

  it('affiche l’erreur de chargement des tickets', async () => {
    const base = createDemoMessagerieSource({ space: 'console', now: () => FIXED_NOW });
    renderMessagerie(<SupportBoardPage />, { space: 'console', source: brokenSource(base, ['listTickets']) });
    expect((await screen.findByText('Impossible de charger les tickets.'))).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tickets ouverts' })).toBeTruthy();
  });
});

describe('TicketPage', () => {
  it('affiche le ticket, son fil avec notes internes, les informations et les éléments liés', async () => {
    const { container } = renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    expect(await screen.findByRole('heading', { level: 1, name: /E-mails de relance non reçus/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe('/support');
    expect(screen.getByRole('list', { name: 'Échanges du ticket' }).querySelectorAll('article').length).toBeGreaterThan(1);
    expect(screen.getByText('INC-2026-031')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Informations du ticket' }).textContent).toContain('Gestion Les Tilleuls');
    await expectNoA11yViolations(container);
  });

  it('change le statut : mettre en attente, résoudre puis rouvrir', async () => {
    const { source } = renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mettre en attente' }));
    expect(await screen.findByText('Ticket mis en attente du client.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Marquer résolu' }));
    expect(await screen.findByText('Ticket marqué comme résolu.')).toBeTruthy();
    expect(ticketDetailSchema.parse(await source.getTicket('tk-2094')).status).toBe('resolu');
    await userEvent.click(await screen.findByRole('button', { name: 'Rouvrir' }));
    expect(await screen.findByText('Ticket rouvert.')).toBeTruthy();
    expect(ticketDetailSchema.parse(await source.getTicket('tk-2094')).status).toBe('ouvert');
  });

  it('assigne le ticket depuis le menu', async () => {
    const { source } = renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    await userEvent.click(await screen.findByRole('button', { name: /Assigné à Inès Garnier/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Julie Fontaine' }));
    expect(await screen.findByText('Ticket assigné à Julie Fontaine.')).toBeTruthy();
    expect(ticketDetailSchema.parse(await source.getTicket('tk-2094')).assigneeName).toBe('Julie Fontaine');
    await userEvent.click(await screen.findByRole('button', { name: /Assigné à Julie Fontaine/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Retirer l’assignation' }));
    expect(await screen.findByText('Ticket désassigné.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Assigner' })).toBeTruthy();
  });

  it('change la priorité', async () => {
    const { source } = renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    await userEvent.click(await screen.findByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Basse' }));
    expect(await screen.findByText('Priorité basse enregistrée.')).toBeTruthy();
    expect(ticketDetailSchema.parse(await source.getTicket('tk-2094')).priority).toBe('basse');
  });

  it('répond au client puis ajoute une note interne', async () => {
    renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    await screen.findByRole('list', { name: 'Échanges du ticket' });
    const count = () => screen.getByRole('list', { name: 'Échanges du ticket' }).querySelectorAll('article').length;
    const before = count();
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre réponse' }), 'Correctif déployé.');
    await userEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(await screen.findByText('Correctif déployé.')).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre réponse' }), 'Surveiller ce soir.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Note interne' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la note' }));
    expect(await screen.findByText('Surveiller ce soir.')).toBeTruthy();
    expect(count()).toBe(before + 2);
    expect(screen.getAllByText('Note interne').length).toBeGreaterThan(0);
  });

  it('demande un accès justifié : motif trop court refusé puis accès tracé', async () => {
    const { source } = renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console' });
    await userEvent.click(await screen.findByRole('button', { name: 'Demander un accès justifié' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif de l’accès' }), 'court');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès' }));
    expect(await within(dialog).findByText('Indiquez un motif d’au moins 10 caractères')).toBeTruthy();
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Motif de l’accès' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif de l’accès' }), 'Vérifier les journaux d’envoi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir l’accès' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(await screen.findByText('Accès justifié ouvert pour 60 minutes.')).toBeTruthy();
    expect(ticketDetailSchema.parse(await source.getTicket('tk-2094')).access?.reason).toBe('Vérifier les journaux d’envoi');
    expect(screen.getByText('Accès ouvert')).toBeTruthy();
  });

  it('signale une erreur d’action sans masquer le ticket', async () => {
    const base = createDemoMessagerieSource({ space: 'console', now: () => FIXED_NOW });
    renderMessagerie(<TicketPage ticketId="tk-2094" />, { space: 'console', source: brokenSource(base, ['updateTicket']) });
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer résolu' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Service indisponible');
    expect(screen.getByRole('heading', { level: 1, name: /E-mails de relance non reçus/ })).toBeTruthy();
  });

  it('signale un ticket introuvable', async () => {
    renderMessagerie(<TicketPage ticketId="inconnu" />, { space: 'console' });
    expect((await screen.findByRole('alert')).textContent).toContain('Ticket introuvable ou inaccessible.');
  });
});
