import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { FIXED_NOW } from '../../../test/render';
import {
  conversationDetailSchema,
  conversationListSchema,
  helpCenterSchema,
  inboxStatsSchema,
  recipientSchema,
  staffMemberSchema,
  supportStatusSchema,
  ticketDetailSchema,
  ticketListSchema,
  ticketStatsSchema,
  ticketSummarySchema,
} from '../schemas';
import type { MessagerieSpace } from '../demo';
import { z } from 'zod';
import { CAMPAIGNS_UNAVAILABLE_MESSAGE, createApiMessagerieSource } from './index';
import { NO_ORGANIZATION_MESSAGE } from './conversations';
import { formatDelay } from './shared';
import { OPERATOR_TICKET_MESSAGE } from './tickets';
import * as api from './responses.fixtures';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(responses: Response[], space: MessagerieSpace = 'agence', organizationId: string | null = api.IDS.org) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    return next ? Promise.resolve(next) : Promise.reject(new TypeError('Aucune réponse prévue'));
  });
  const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl, readCookie: () => 'xsrf' });
  const source = createApiMessagerieSource({ client, organizationId, space }, { now: () => FIXED_NOW });
  const call = (index: number) => {
    const [input, init = {}] = fetchImpl.mock.calls[index] ?? ['', {}];
    const url = typeof input === 'string' ? input : '';
    const jsonBody = (): unknown => (typeof init.body === 'string' ? JSON.parse(init.body) : null);
    return { url: new URL(url), init, jsonBody };
  };
  return { source, fetchImpl, call };
}

const photo = () => new File([new Uint8Array(100)], 'photo.png', { type: 'image/png' });
const query = { tab: 'all' as const, search: '  fuite ', page: 1, pageSize: 20 };

describe('source API : conversations', () => {
  it('liste les conversations et mappe la réponse Laravel vers les schémas d’affichage', async () => {
    const { source, call } = setup([json(200, api.conversationListResponse)]);
    const list = conversationListSchema.parse(await source.listConversations(query));

    expect(call(0).url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversations`);
    expect(Object.fromEntries(call(0).url.searchParams)).toEqual({ tab: 'all', search: 'fuite', page: '1', per_page: '20' });
    expect(list).toMatchObject({ viewerId: api.IDS.me, total: 2, page: 1, pageSize: 20 });
    expect(list.counts).toEqual({ all: 2, unread: 1, awaiting: 1, sent: 1, archived: 0, mandant: 0, locataire: 0 });
    expect(list.items[0]).toMatchObject({
      subject: 'Fuite au 3e étage',
      counterpart: { name: 'Marc Chevalier', initials: 'MC', role: 'agence' },
      lastMessageAt: '2026-11-14T09:30:00+00:00',
      unread: true,
      awaitingReply: true,
      hasAttachments: true,
    });
    expect(list.items[1]?.counterpart.name).toBe('Ancien participant');
  });

  it('donne le rôle gestionnaire hors de l’espace agence', async () => {
    const { source } = setup([json(200, api.conversationListResponse)], 'proprietaire');
    const list = conversationListSchema.parse(await source.listConversations(query));
    expect(list.items[0]?.counterpart.role).toBe('gestionnaire');
  });

  it('renvoie une liste vide pour les onglets sans équivalent serveur, sans simuler de données', async () => {
    const { source } = setup([json(200, api.conversationListResponse)]);
    const list = conversationListSchema.parse(await source.listConversations({ ...query, tab: 'mandant' }));
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
    expect(list.viewerId).toBe(api.IDS.me);
  });

  it('ouvre une conversation avec ses messages, participants et pièces jointes', async () => {
    const { source, call } = setup([json(200, api.conversationDetailResponse)]);
    const detail = conversationDetailSchema.parse(await source.getConversation(api.IDS.conversation));

    expect(call(0).url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversations/${api.IDS.conversation}`);
    expect(detail.viewerId).toBe(api.IDS.me);
    expect(detail.participants.map((member) => member.name)).toEqual(['Awa Diallo', 'Marc Chevalier']);
    expect(detail.messages[1]).toMatchObject({
      authorId: api.IDS.colleague,
      internal: false,
      attachments: [{ name: 'quittance.pdf', mimeType: 'application/pdf', sizeBytes: 20480 }],
    });
  });

  it('démarre une conversation en FormData avec les pièces jointes', async () => {
    const { source, call } = setup([json(201, api.conversationDetailResponse)]);
    const created = conversationDetailSchema.parse(
      await source.createConversation({ recipientId: api.IDS.colleague, linkId: null, subject: 'Fuite', body: 'Bonjour', attachments: [photo()] }),
    );

    const { url, init } = call(0);
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversations`);
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('recipient_id')).toBe(api.IDS.colleague);
    expect(form.get('subject')).toBe('Fuite');
    expect(form.get('body')).toBe('Bonjour');
    expect(form.getAll('attachments[]')).toHaveLength(1);
    expect((form.getAll('attachments[]')[0] as File).name).toBe('photo.png');
    expect(created.id).toBe(api.IDS.conversation);
  });

  it('répond dans une conversation en FormData', async () => {
    const { source, call } = setup([json(200, api.conversationDetailResponse)]);
    await source.replyToConversation(api.IDS.conversation, { body: 'J’y vais à 14 h.', attachments: [photo()] });

    const { url, init } = call(0);
    expect(url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversations/${api.IDS.conversation}/messages`);
    const form = init.body as FormData;
    expect(form.get('body')).toBe('J’y vais à 14 h.');
    expect(form.getAll('attachments[]')).toHaveLength(1);
  });

  it('change l’état lu et archivé par PATCH JSON', async () => {
    const summary = { data: api.conversationSummary };
    const { source, call } = setup([json(200, summary), json(200, summary)]);
    await source.setConversationRead(api.IDS.conversation, true);
    await source.setConversationArchived(api.IDS.conversation, true);

    expect(call(0).init.method).toBe('PATCH');
    expect(call(0).init.body).toBe('{"read":true}');
    expect(call(1).init.body).toBe('{"archived":true}');
  });

  it('calcule les indicateurs de la boîte sans inventer de délai moyen', async () => {
    const { source, call } = setup([json(200, api.conversationStatsResponse)]);
    const stats = inboxStatsSchema.parse(await source.inboxStats());

    expect(call(0).url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversations/stats`);
    expect(stats.unread).toBe(3);
    expect(stats.stale).toEqual({ count: 2, detail: '2 en attente depuis plus de 48 h' });
    expect(stats.averageReplyLabel).toBe('—');
  });

  it('liste les destinataires de l’équipe', async () => {
    const { source } = setup([json(200, api.recipientsResponse)], 'proprietaire');
    const recipients = z.array(recipientSchema).parse(await source.listRecipients());
    expect(recipients).toEqual([
      { id: api.IDS.colleague, name: 'Marc Chevalier', initials: 'MC', role: 'gestionnaire', linkOptions: [] },
    ]);
  });

  it('refuse explicitement toute conversation hors espace organisation, sans appel réseau', async () => {
    const { source, fetchImpl } = setup([], 'locataire', null);
    const calls = [
      source.inboxStats(),
      source.listConversations(query),
      source.getConversation('x'),
      source.listRecipients(),
      source.replyToConversation('x', { body: 'a', attachments: [] }),
      source.createConversation({ recipientId: 'x', linkId: null, subject: 's', body: 'b', attachments: [] }),
      source.setConversationRead('x', true),
      source.setConversationArchived('x', true),
    ];
    for (const result of calls) await expect(result).rejects.toThrow(NO_ORGANIZATION_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('source API : support côté demandeur', () => {
  it('liste mes demandes et dérive l’organisation de l’espace quand elle est absente', async () => {
    const { source, call } = setup([json(200, api.myTicketListResponse)], 'locataire', null);
    const tickets = z.array(ticketSummarySchema).parse(await source.listMyTickets());

    expect(call(0).url.pathname).toBe('/api/v1/support/tickets');
    expect(tickets[0]).toMatchObject({
      reference: 'SUP-2026-00001',
      organization: 'Espace locataire',
      status: 'ouvert',
      priority: 'normale',
      category: 'facturation',
      assigneeId: null,
      assigneeName: null,
      requester: { name: 'Awa Diallo', initials: 'AD', role: 'locataire' },
      updatedAt: '2026-11-13T10:15:00+00:00',
    });
  });

  it('ouvre une demande avec délai de première réponse, rôles et accès', async () => {
    const { source, call } = setup([json(200, api.ticketDetailResponse)]);
    const ticket = ticketDetailSchema.parse(await source.getMyTicket(api.IDS.ticket));

    expect(call(0).url.pathname).toBe(`/api/v1/support/tickets/${api.IDS.ticket}`);
    expect(ticket.viewerId).toBe(api.IDS.me);
    expect(ticket.firstResponseLabel).toBe('2 h 15');
    expect(ticket.status).toBe('en_attente');
    expect(ticket.priority).toBe('haute');
    expect(ticket.category).toBe('documents');
    expect(ticket.assigneeName).toBe('Ops Support');
    expect(ticket.participants.map((member) => [member.name, member.role])).toEqual([
      ['Awa Diallo', 'agence'],
      ['Ops Support', 'support'],
    ]);
    expect(ticket.messages[0]?.attachments[0]?.name).toBe('quittance.pdf');
    expect(ticket.linked).toEqual([]);
  });

  it('ouvre une demande en FormData avec espace, organisation, catégorie et pièces jointes', async () => {
    const { source, call } = setup([json(201, api.ticketDetailResponse)], 'agence');
    await source.createSupportTicket({ category: 'facturation', subject: 'Facture', body: 'Bonjour', attachments: [photo()] });

    const { url, init } = call(0);
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/support/tickets');
    const form = init.body as FormData;
    expect(Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string'))).toEqual({
      space: 'organization',
      organization_id: api.IDS.org,
      category: 'billing',
      subject: 'Facture',
      body: 'Bonjour',
    });
    expect(form.getAll('attachments[]')).toHaveLength(1);
  });

  it('n’envoie pas d’organisation pour un locataire', async () => {
    const { source, call } = setup([json(201, api.ticketDetailResponse)], 'locataire', null);
    await source.createSupportTicket({ category: 'autre', subject: 'Aide', body: 'Bonjour', attachments: [] });
    const form = call(0).init.body as FormData;
    expect(form.get('space')).toBe('tenant');
    expect(form.get('category')).toBe('other');
    expect(form.has('organization_id')).toBe(false);
  });

  it('interdit à un opérateur d’ouvrir une demande', async () => {
    const { source, fetchImpl } = setup([], 'console', null);
    await expect(source.createSupportTicket({ category: 'autre', subject: 'a', body: 'b', attachments: [] })).rejects.toThrow(OPERATOR_TICKET_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('répond à ma demande en FormData', async () => {
    const { source, call } = setup([json(200, api.ticketDetailResponse)]);
    await source.replyToMyTicket(api.IDS.ticket, { body: 'Merci', attachments: [photo()] });

    expect(call(0).url.pathname).toBe(`/api/v1/support/tickets/${api.IDS.ticket}/messages`);
    const form = call(0).init.body as FormData;
    expect(form.get('body')).toBe('Merci');
    expect(form.has('internal')).toBe(false);
    expect(form.getAll('attachments[]')).toHaveLength(1);
  });
});

describe('source API : console', () => {
  it('filtre et mappe la liste des tickets avec ses compteurs', async () => {
    const { source, call } = setup([json(200, api.consoleTicketListResponse)], 'console', null);
    const list = ticketListSchema.parse(
      await source.listTickets({ tab: 'en_attente', search: 'quittance', priority: 'haute', assigneeId: 'none', page: 2, pageSize: 10 }),
    );

    expect(call(0).url.pathname).toBe('/api/v1/console/support/tickets');
    expect(Object.fromEntries(call(0).url.searchParams)).toEqual({
      status: 'waiting',
      priority: 'high',
      assignee: 'none',
      search: 'quittance',
      page: '2',
      per_page: '10',
    });
    expect(list).toMatchObject({ total: 1, page: 1, pageSize: 20, counts: { ouvert: 4, en_attente: 1, resolu: 7, tous: 12 } });
    expect(list.items[0]?.organization).toBe('Agence du Port');
  });

  it('n’envoie aucun filtre pour « tous » et « toutes »', async () => {
    const { source, call } = setup([json(200, api.consoleTicketListResponse)], 'console', null);
    await source.listTickets({ tab: 'tous', search: '', priority: 'toutes', assigneeId: 'tous', page: 1, pageSize: 20 });
    expect(Object.fromEntries(call(0).url.searchParams)).toEqual({ page: '1', per_page: '20' });
  });

  it('formate les statistiques avec le délai médian de première réponse', async () => {
    const { source } = setup([json(200, api.ticketStatsResponse), json(200, { data: { ...api.ticketStatsResponse.data, first_response_minutes: null } })], 'console', null);
    const stats = ticketStatsSchema.parse(await source.ticketStats());
    expect(stats).toMatchObject({ open: 4, openHigh: 1, waiting: 1, resolved30d: 7, firstResponse: '2 h 15', firstResponseDetail: 'Médiane sur 30 jours' });
    const empty = ticketStatsSchema.parse(await source.ticketStats());
    expect(empty).toMatchObject({ firstResponse: '—', firstResponseDetail: 'Aucune réponse sur 30 jours' });
  });

  it('liste les opérateurs', async () => {
    const { source } = setup([json(200, api.staffResponse)], 'console', null);
    expect(z.array(staffMemberSchema).parse(await source.listStaff())).toEqual([{ id: api.IDS.operator, name: 'Ops Support' }]);
  });

  it('ouvre un ticket en vue support : messages internes, accès et opérateur courant', async () => {
    const { source } = setup([json(200, api.ticketDetailResponse)], 'console', null);
    const ticket = ticketDetailSchema.parse(await source.getTicket(api.IDS.ticket));

    expect(ticket.viewerId).toBe(api.IDS.operator);
    expect(ticket.messages.map((message) => message.internal)).toEqual([false, false, true]);
    expect(ticket.participants.map((member) => member.role)).toEqual(['agence', 'operateur']);
    expect(ticket.access).toEqual({
      reason: 'Vérifier la quittance manquante de mars',
      grantedAt: '2026-11-13T10:30:00+00:00',
      expiresAt: '2026-11-13T11:30:00+00:00',
    });
  });

  it('modifie un ticket avec les valeurs serveur', async () => {
    const { source, call } = setup([json(200, api.ticketDetailResponse)], 'console', null);
    await source.updateTicket(api.IDS.ticket, { status: 'resolu', priority: 'basse', assigneeId: null });

    expect(call(0).init.method).toBe('PATCH');
    expect(call(0).url.pathname).toBe(`/api/v1/console/support/tickets/${api.IDS.ticket}`);
    expect(call(0).jsonBody()).toEqual({ status: 'resolved', priority: 'low', assignee_id: null });
  });

  it('répond en note interne puis demande un accès justifié', async () => {
    const { source, call } = setup([json(200, api.ticketDetailResponse), json(200, api.ticketDetailResponse)], 'console', null);
    await source.replyToTicket(api.IDS.ticket, { body: 'Note interne', attachments: [], internal: true });
    await source.requestTicketAccess(api.IDS.ticket, 'Vérifier la quittance manquante de mars');

    const form = call(0).init.body as FormData;
    expect(form.get('internal')).toBe('1');
    expect(call(0).url.pathname).toBe(`/api/v1/console/support/tickets/${api.IDS.ticket}/messages`);
    expect(call(1).url.pathname).toBe(`/api/v1/console/support/tickets/${api.IDS.ticket}/access`);
    expect(call(1).jsonBody()).toEqual({ reason: 'Vérifier la quittance manquante de mars' });
  });

  it('utilise l’identifiant d’opérateur fourni quand il est connu', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: () => Promise.resolve(json(200, api.ticketDetailResponse)), readCookie: () => 'x' });
    const source = createApiMessagerieSource({ client, organizationId: null, space: 'console', viewerId: 'op-courant' });
    expect(ticketDetailSchema.parse(await source.getTicket(api.IDS.ticket)).viewerId).toBe('op-courant');
  });
});

describe('source API : erreurs', () => {
  it('relaie le message français d’un conflit 409', async () => {
    const { source } = setup([json(409, api.resolvedProblem)]);
    await expect(source.replyToMyTicket(api.IDS.ticket, { body: 'Encore', attachments: [] })).rejects.toMatchObject({
      status: 409,
      code: 'ticket_resolved',
      message: 'Cette demande est résolue : ouvrez-en une nouvelle.',
    });
  });

  it('affiche la première erreur de champ d’un 422', async () => {
    const { source } = setup([json(422, api.validationProblem)]);
    await expect(
      source.createConversation({ recipientId: api.IDS.colleague, linkId: null, subject: 's', body: 'b', attachments: [photo()] }),
    ).rejects.toThrow('Le fichier « photo.png » dépasse 10 Mo.');
  });

  it('garde le message du problème quand un 422 n’a pas de champ', async () => {
    const { source } = setup([json(422, { code: 'recipient_not_found', detail: 'Ce destinataire ne fait pas partie de vos contacts.' })]);
    await expect(
      source.createConversation({ recipientId: 'x', linkId: null, subject: 's', body: 'b', attachments: [] }),
    ).rejects.toThrow('Ce destinataire ne fait pas partie de vos contacts.');
  });

  it('signale un serveur injoignable', async () => {
    const { source } = setup([]);
    await expect(source.listConversations(query)).rejects.toThrow('Le serveur est injoignable');
  });

  it('refuse une réponse qui ne respecte pas le contrat, sans exposer l’erreur Zod', async () => {
    const { source } = setup([json(200, { data: { unread: 'beaucoup' } })]);
    await expect(source.inboxStats()).rejects.toThrow('Réponse inattendue du serveur. Réessayez dans un instant.');
  });
});

describe('source API : fonctions sans équivalent serveur', () => {
  it('rejette toutes les fonctions de campagne sans appel réseau', async () => {
    const { source, fetchImpl } = setup([]);
    const results = [
      source.listCampaigns({ tab: 'all', search: '', building: 'all', period: 'all', page: 1, pageSize: 10 }),
      source.getCampaign('c1'),
      source.listCampaignAudiences(),
      source.saveCampaign({ id: null, audienceId: 'a', buildingIds: [], subject: 's', body: 'b', mode: 'now', scheduledAt: null, copyToHistory: false, attachments: [] }),
      source.sendCampaignTest({ subject: 's', body: 'b', attachments: [] }),
    ];
    for (const result of results) await expect(result).rejects.toThrow(CAMPAIGNS_UNAVAILABLE_MESSAGE);
    expect(CAMPAIGNS_UNAVAILABLE_MESSAGE).toBe('Les campagnes ne sont pas encore disponibles.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each<MessagerieSpace>(['locataire', 'proprietaire', 'agence', 'bailleur', 'console'])(
    '%s : centre d’aide et statut du support éditoriaux, sans appel réseau',
    async (space) => {
      const { source, fetchImpl } = setup([], space, null);
      expect(helpCenterSchema.parse(await source.helpCenter()).categories.length).toBeGreaterThan(0);
      expect(supportStatusSchema.parse(await source.supportStatus()).hoursLabel).toBeTruthy();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('formatDelay', () => {
  it.each([
    [0, 'Moins d’1 min'],
    [45, '45 min'],
    [60, '1 h'],
    [135, '2 h 15'],
    [125, '2 h 05'],
    [1440, '1 j'],
    [1500, '1 j 1 h'],
  ])('%i min -> %s', (minutes, label) => {
    expect(formatDelay(minutes)).toBe(label);
  });
});
