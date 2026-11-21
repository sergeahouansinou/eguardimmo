import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import {
  conversationDetailSchema,
  conversationListSchema,
  helpCenterSchema,
  inboxStatsSchema,
  recipientSchema,
  supportStatusSchema,
} from '../schemas';
import type { MessagerieSpace } from '../demo';
import { z } from 'zod';
import { CAMPAIGNS_UNAVAILABLE_MESSAGE, createApiMessagerieSource } from './index';
import { NO_ORGANIZATION_MESSAGE } from './conversations';
import { formatDelay } from './shared';
import { TICKETS_UNAVAILABLE_MESSAGE } from './tickets';
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
  const source = createApiMessagerieSource({ client, organizationId, space, fetchImpl });
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

describe('source API : pièces jointes des conversations', () => {
  const pdf = (type = 'application/pdf') => new Response('%PDF', { status: 200, headers: { 'Content-Type': type } });
  const piece = { id: api.IDS.attachment, name: '../../etc/passwd<script>.pdf' };

  it('télécharge la pièce par la route de l’organisation et l’enregistre sous un nom assaini', async () => {
    const { source, call } = setup([pdf('application/pdf; charset=binary')]);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });

    await source.downloadConversationAttachment?.(piece);

    expect(call(0).url.pathname).toBe(`/api/v1/org/${api.IDS.org}/conversation-attachments/${api.IDS.attachment}`);
    expect(call(0).init).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(names).toEqual(['etc passwd script .pdf']);
  });

  it.each(['text/html', 'image/svg+xml', 'application/octet-stream', 'image/gif'])('refuse un contenu %s sans rien enregistrer', async (type) => {
    const { source } = setup([pdf(type)]);
    const save = vi.spyOn(URL, 'createObjectURL');
    save.mockClear();
    await expect(source.downloadConversationAttachment?.(piece)).rejects.toThrow('Le serveur a répondu de façon inattendue');
    expect(save).not.toHaveBeenCalled();
  });

  it('traduit un refus serveur sans enregistrer de fichier', async () => {
    const { source } = setup([json(404, { code: 'attachment_not_found', message: 'Pièce introuvable.' })]);
    await expect(source.downloadConversationAttachment?.(piece)).rejects.toMatchObject({ status: 404 });
  });

  it('refuse hors organisation, sans appel réseau', async () => {
    const { source, fetchImpl } = setup([], 'agence', null);
    await expect(source.downloadConversationAttachment?.(piece)).rejects.toThrow(NO_ORGANIZATION_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('source API : erreurs', () => {
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
    '%s : centre d’aide éditorial, sans appel réseau',
    async (space) => {
      const { source, fetchImpl } = setup([], space, null);
      expect(helpCenterSchema.parse(await source.helpCenter()).categories.length).toBeGreaterThan(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('lit le statut du support sur le serveur, sans horaire codé en dur', async () => {
    const { source, call } = setup([
      json(200, { data: { online: false, hours_label: 'Lundi–vendredi 9 h – 18 h (Europe/Paris)', response_label: 'Réponse sous 1 jour ouvré', timezone: 'Europe/Paris', hours: [] } }),
    ]);
    expect(supportStatusSchema.parse(await source.supportStatus())).toEqual({
      online: false,
      hoursLabel: 'Lundi–vendredi 9 h – 18 h (Europe/Paris)',
      responseLabel: 'Réponse sous 1 jour ouvré',
    });
    expect(call(0).url.pathname).toBe('/api/v1/support/status');
  });
});

describe('source API : support', () => {
  it('renvoie « indisponible » pour chaque lecture du support, sans appel réseau', async () => {
    const { source, fetchImpl } = setup([]);
    const results = [
      source.listTickets({ tab: 'tous', priority: 'toutes', assigneeId: 'tous', search: '', page: 1, pageSize: 10 }),
      source.ticketStats(),
      source.getTicket('t1'),
      source.listStaff(),
      source.updateTicket('t1', { status: 'resolu' }),
      source.replyToTicket('t1', { body: 'b', attachments: [], internal: false }),
      source.requestTicketAccess('t1', 'Vérifier la quittance'),
      source.listMyTickets(),
      source.getMyTicket('t1'),
      source.createSupportTicket({ category: 'compte', subject: 's', body: 'b', attachments: [] }),
      source.replyToMyTicket('t1', { body: 'b', attachments: [] }),
    ];
    for (const result of results) await expect(result).rejects.toThrow(TICKETS_UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
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
