import { describe, expect, it } from 'vitest';
import { FIXED_NOW } from '../../test/render';
import { createDemoMessagerieSource, demoSeeds } from './demo';
import type { MessagerieSpace } from './demo';
import {
  campaignAudienceSchema,
  campaignListSchema,
  conversationDetailSchema,
  conversationListSchema,
  helpCenterSchema,
  inboxStatsSchema,
  recipientSchema,
  supportStatusSchema,
  ticketDetailSchema,
  ticketListSchema,
  ticketStatsSchema,
  ticketSummarySchema,
} from './schemas';
import { z } from 'zod';

const spaces: MessagerieSpace[] = ['locataire', 'proprietaire', 'agence', 'bailleur', 'console'];
const create = (space: MessagerieSpace, now = FIXED_NOW) => createDemoMessagerieSource({ space, now: () => now });
const query = { tab: 'all' as const, search: '', building: 'all', period: 'all', page: 1, pageSize: 50 };
const png = (size = 100) => new File([new Uint8Array(size)], 'photo.png', { type: 'image/png' });

describe('fixtures de démonstration', () => {
  it.each(spaces)('%s : toutes les réponses respectent les schémas', async (space) => {
    const source = create(space);
    expect(demoSeeds[space]().me.id).toBeTruthy();
    helpCenterSchema.parse(await source.helpCenter());
    supportStatusSchema.parse(await source.supportStatus());
    z.array(ticketSummarySchema).parse(await source.listMyTickets());
    if (space === 'console') {
      ticketListSchema.parse(await source.listTickets({ tab: 'tous', search: '', priority: 'toutes', assigneeId: 'tous', page: 1, pageSize: 50 }));
      ticketStatsSchema.parse(await source.ticketStats());
      return;
    }
    const list = conversationListSchema.parse(await source.listConversations(query));
    expect(list.items.length).toBeGreaterThan(0);
    for (const item of list.items) conversationDetailSchema.parse(await source.getConversation(item.id));
    z.array(recipientSchema).parse(await source.listRecipients());
    inboxStatsSchema.parse(await source.inboxStats());
    if (space === 'agence' || space === 'bailleur') {
      campaignListSchema.parse(await source.listCampaigns({ tab: 'all', search: '', building: 'all', period: 'all', page: 1, pageSize: 50 }));
      z.array(campaignAudienceSchema).parse(await source.listCampaignAudiences());
    }
  });

  it('chaque conversation de chaque espace a un total cohérent avec ses compteurs', async () => {
    const source = create('agence');
    const list = conversationListSchema.parse(await source.listConversations(query));
    expect(list.total).toBe(list.counts.all);
  });
});

describe('conversations', () => {
  it('une réponse ajoute réellement un message et met à jour l’aperçu', async () => {
    const source = create('locataire');
    const before = conversationDetailSchema.parse(await source.getConversation('c-virement'));
    const after = conversationDetailSchema.parse(
      await source.replyToConversation('c-virement', { body: '  Virement effectué ce matin.  ', attachments: [png()] }),
    );
    expect(after.messages).toHaveLength(before.messages.length + 1);
    const last = after.messages.at(-1);
    expect(last?.body).toBe('Virement effectué ce matin.');
    expect(last?.authorId).toBe(after.viewerId);
    expect(last?.attachments[0]?.name).toBe('photo.png');
    const reread = conversationDetailSchema.parse(await source.getConversation('c-virement'));
    expect(reread.messages).toHaveLength(after.messages.length);
    expect(reread.awaitingReply).toBe(false);
  });

  it('refuse un message vide, une pièce jointe invalide et trop de pièces', async () => {
    const source = create('locataire');
    await expect(source.replyToConversation('c-virement', { body: '   ', attachments: [] })).rejects.toThrow();
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    await expect(source.replyToConversation('c-virement', { body: 'Ok', attachments: [exe] })).rejects.toThrow(/PDF/);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'gros.pdf', { type: 'application/pdf' });
    await expect(source.replyToConversation('c-virement', { body: 'Ok', attachments: [big] })).rejects.toThrow(/10 Mo/);
    const six = Array.from({ length: 6 }, () => png());
    await expect(source.replyToConversation('c-virement', { body: 'Ok', attachments: six })).rejects.toThrow(/5 pièces/);
  });

  it('refuse une conversation inconnue', async () => {
    await expect(create('locataire').getConversation('inconnue')).rejects.toThrow();
  });

  it('crée une conversation visible dans la liste, non lue côté destinataire inchangée', async () => {
    const source = create('agence');
    const recipients = z.array(recipientSchema).parse(await source.listRecipients());
    const target = recipients[0];
    if (!target) throw new Error('aucun destinataire');
    const before = conversationListSchema.parse(await source.listConversations(query));
    const created = conversationDetailSchema.parse(
      await source.createConversation({ recipientId: target.id, linkId: null, subject: 'Devis plomberie', body: 'Bonjour, voici le devis.', attachments: [] }),
    );
    expect(created.subject).toBe('Devis plomberie');
    expect(created.messages).toHaveLength(1);
    const after = conversationListSchema.parse(await source.listConversations(query));
    expect(after.total).toBe(before.total + 1);
    expect(after.items[0]?.id).toBe(created.id);
  });

  it('refuse un destinataire inconnu et un sujet vide', async () => {
    const source = create('agence');
    await expect(
      source.createConversation({ recipientId: 'personne', linkId: null, subject: 'Sujet', body: 'Texte', attachments: [] }),
    ).rejects.toThrow();
    const recipients = z.array(recipientSchema).parse(await source.listRecipients());
    await expect(
      source.createConversation({ recipientId: recipients[0]?.id ?? '', linkId: null, subject: '  ', body: 'Texte', attachments: [] }),
    ).rejects.toThrow();
  });

  it('marque lu et archive en modifiant les compteurs', async () => {
    const source = create('locataire');
    const before = conversationListSchema.parse(await source.listConversations(query));
    expect(before.items.find((item) => item.id === 'c-virement')?.unread).toBe(true);
    await source.setConversationRead('c-virement', true);
    await source.setConversationArchived('c-relance', true);
    const after = conversationListSchema.parse(await source.listConversations(query));
    expect(after.items.find((item) => item.id === 'c-virement')?.unread).toBe(false);
    expect(after.items.some((item) => item.id === 'c-relance')).toBe(false);
    expect(after.counts.archived).toBe(before.counts.archived + 1);
    const archived = conversationListSchema.parse(await source.listConversations({ ...query, tab: 'archived' }));
    expect(archived.items.map((item) => item.id)).toContain('c-relance');
  });

  it('recherche sans tenir compte des accents et pagine', async () => {
    const source = create('locataire');
    const found = conversationListSchema.parse(await source.listConversations({ ...query, search: 'regularisation' }));
    expect(found.items.map((item) => item.id)).toEqual(['c-regularisation']);
    const paged = conversationListSchema.parse(await source.listConversations({ ...query, pageSize: 2, page: 2 }));
    expect(paged.items).toHaveLength(2);
    expect(paged.total).toBeGreaterThan(2);
  });
});

describe('campagnes', () => {
  const base = { id: null, audienceId: 'aud-locataires', buildingIds: [], subject: 'Coupure d’eau', body: 'Bonjour {{Prénom}}', copyToHistory: true, attachments: [] };

  it('envoie, programme et enregistre un brouillon en modifiant la liste', async () => {
    const source = create('agence');
    const before = campaignListSchema.parse(await source.listCampaigns({ tab: 'all', search: '', building: 'all', period: 'all', page: 1, pageSize: 50 }));
    const sent = await source.saveCampaign({ ...base, mode: 'now', scheduledAt: null });
    expect(sent).toMatchObject({ status: 'envoyee', recipientCount: 12, failedCount: 1 });
    const scheduled = await source.saveCampaign({ ...base, subject: 'Rappel', mode: 'scheduled', scheduledAt: '2026-11-20T09:00:00+01:00' });
    expect(scheduled).toMatchObject({ status: 'programmee' });
    const draft = await source.saveCampaign({ ...base, subject: 'Brouillon', body: '', mode: 'draft', scheduledAt: null });
    expect(draft).toMatchObject({ status: 'brouillon' });
    const after = campaignListSchema.parse(await source.listCampaigns({ tab: 'all', search: '', building: 'all', period: 'all', page: 1, pageSize: 50 }));
    expect(after.total).toBe(before.total + 3);
    expect(after.counts.brouillon).toBe(before.counts.brouillon + 1);
  });

  it('refuse une date passée, un destinataire inconnu et la modification d’une campagne envoyée', async () => {
    const source = create('agence');
    await expect(source.saveCampaign({ ...base, mode: 'scheduled', scheduledAt: '2026-11-01T09:00:00+01:00' })).rejects.toThrow(/futur/);
    await expect(source.saveCampaign({ ...base, audienceId: 'inconnue', mode: 'now', scheduledAt: null })).rejects.toThrow();
    await expect(source.saveCampaign({ ...base, id: 'camp-adresse', mode: 'now', scheduledAt: null })).rejects.toThrow(/envoyée/);
  });

  it('reprend un brouillon existant sans le dupliquer', async () => {
    const source = create('agence');
    const draft = z.object({ id: z.string() }).parse(await source.saveCampaign({ ...base, mode: 'draft', scheduledAt: null }));
    const sent = await source.saveCampaign({ ...base, id: draft.id, subject: 'Final', mode: 'now', scheduledAt: null });
    expect(sent).toMatchObject({ id: draft.id, status: 'envoyee', title: 'Final' });
    const list = campaignListSchema.parse(await source.listCampaigns({ tab: 'brouillon', search: '', building: 'all', period: 'all', page: 1, pageSize: 50 }));
    expect(list.items.some((item) => item.id === draft.id)).toBe(false);
  });
});

describe('tickets de la console', () => {
  const all = { tab: 'tous' as const, search: '', priority: 'toutes' as const, assigneeId: 'tous', page: 1, pageSize: 50 };

  it('filtre par statut, priorité, assignation et recherche', async () => {
    const source = create('console');
    const high = ticketListSchema.parse(await source.listTickets({ ...all, priority: 'haute' }));
    expect(high.items.every((item) => item.priority === 'haute')).toBe(true);
    const none = ticketListSchema.parse(await source.listTickets({ ...all, assigneeId: 'none' }));
    expect(none.items.every((item) => item.assigneeId === null)).toBe(true);
    const found = ticketListSchema.parse(await source.listTickets({ ...all, search: 'relance' }));
    expect(found.items.map((item) => item.id)).toContain('tk-2094');
    const resolved = ticketListSchema.parse(await source.listTickets({ ...all, tab: 'resolu' }));
    expect(resolved.items.every((item) => item.status === 'resolu')).toBe(true);
  });

  it('assigner, changer le statut et la priorité modifie le ticket et les indicateurs', async () => {
    const source = create('console');
    const before = ticketStatsSchema.parse(await source.ticketStats());
    const updated = ticketDetailSchema.parse(await source.updateTicket('tk-2094', { status: 'resolu', priority: 'basse', assigneeId: 'op-theo' }));
    expect(updated).toMatchObject({ status: 'resolu', priority: 'basse', assigneeName: 'Théo Marchand' });
    const after = ticketStatsSchema.parse(await source.ticketStats());
    expect(after.open).toBe(before.open - 1);
    expect(after.resolved30d).toBe(before.resolved30d + 1);
    await expect(source.updateTicket('tk-2094', { assigneeId: 'inconnu' })).rejects.toThrow();
    await expect(source.updateTicket('inconnu', { status: 'ouvert' })).rejects.toThrow();
  });

  it('une note interne et une demande d’accès sont tracées dans le fil', async () => {
    const source = create('console');
    const before = ticketDetailSchema.parse(await source.getTicket('tk-2094'));
    const noted = ticketDetailSchema.parse(await source.replyToTicket('tk-2094', { body: 'À surveiller', attachments: [], internal: true }));
    expect(noted.messages.at(-1)?.internal).toBe(true);
    const replied = ticketDetailSchema.parse(await source.replyToTicket('tk-2094', { body: 'Correctif déployé', attachments: [] }));
    expect(replied.messages.at(-1)?.internal).toBe(false);
    await expect(source.requestTicketAccess('tk-2094', 'court')).rejects.toThrow();
    const granted = ticketDetailSchema.parse(await source.requestTicketAccess('tk-2094', 'Vérifier les journaux d’envoi'));
    expect(granted.access?.reason).toBe('Vérifier les journaux d’envoi');
    expect(granted.messages).toHaveLength(before.messages.length + 3);
  });
});

describe('support côté client', () => {
  it('crée un ticket et son fil, sans exposer les notes internes ni le ticket d’autrui', async () => {
    const source = create('locataire');
    const before = z.array(ticketSummarySchema).parse(await source.listMyTickets());
    const created = ticketDetailSchema.parse(
      await source.createSupportTicket({ category: 'documents', subject: 'Quittance manquante', body: 'Je ne la vois pas.', attachments: [] }),
    );
    expect(created.messages).toHaveLength(2);
    expect(created.messages[1]?.authorId).toBe('support-eguardimmo');
    const mine = z.array(ticketSummarySchema).parse(await source.listMyTickets());
    expect(mine).toHaveLength(before.length + 1);
    const past = ticketDetailSchema.parse(await source.getMyTicket(before[0]?.id ?? ''));
    expect(past.messages.some((message) => message.internal)).toBe(false);
    expect(past.access).toBeNull();
  });

  it('refuse le ticket d’un autre compte', async () => {
    const source = create('console');
    await expect(source.getMyTicket('tk-2094')).rejects.toThrow(/introuvable/);
    await expect(source.replyToMyTicket('tk-2094', { body: 'Bonjour', attachments: [] })).rejects.toThrow(/introuvable/);
  });

  it('rouvre un ticket résolu quand le client répond', async () => {
    const source = create('locataire');
    const [past] = z.array(ticketSummarySchema).parse(await source.listMyTickets());
    expect(past?.status).toBe('resolu');
    const reopened = ticketDetailSchema.parse(await source.replyToMyTicket(past?.id ?? '', { body: 'Le problème est revenu.', attachments: [] }));
    expect(reopened.status).toBe('ouvert');
    expect(reopened.messages.at(-1)?.body).toBe('Le problème est revenu.');
  });

  it('refuse un sujet vide', async () => {
    await expect(
      create('locataire').createSupportTicket({ category: 'autre', subject: '', body: 'Texte', attachments: [] }),
    ).rejects.toThrow();
  });

  it('calcule l’état en ligne selon l’heure injectée', async () => {
    const online = supportStatusSchema.parse(await create('locataire', FIXED_NOW).supportStatus());
    expect(online.online).toBe(true);
    const night = supportStatusSchema.parse(await create('locataire', new Date('2026-11-14T10:00:00+01:00')).supportStatus());
    expect(night.online).toBe(false);
  });
});
