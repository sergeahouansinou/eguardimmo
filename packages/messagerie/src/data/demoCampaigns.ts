import { campaignInputSchema } from './inputs';
import type { CampaignQuery, SaveCampaignInput } from './inputs';
import type { Campaign } from './schemas';
import { assertAttachments, fold, paginate, run } from './demoState';
import type { DemoContext } from './demoState';

const PARIS = 'Europe/Paris';
const monthOf = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric', timeZone: PARIS }).format(new Date(iso));

function find(context: DemoContext, id: string): Campaign {
  const campaign = context.state.campaigns.find((item) => item.id === id);
  if (!campaign) throw new Error('Campagne introuvable.');
  return campaign;
}

export function campaignHandlers(context: DemoContext) {
  const { state } = context;
  return {
    listCampaigns: (query: CampaignQuery) =>
      run(() => {
        const needle = fold(query.search.trim());
        const inTab = state.campaigns.filter((item) => query.tab === 'all' || item.status === query.tab);
        const found = needle ? inTab.filter((item) => fold(item.title).includes(needle)) : inTab;
        const sorted = [...found].sort((a, b) =>
          (b.sentAt ?? b.scheduledAt ?? '9999').localeCompare(a.sentAt ?? a.scheduledAt ?? '9999'),
        );
        const count = (status: Campaign['status']) => state.campaigns.filter((item) => item.status === status).length;
        const sent = state.campaigns.filter((item) => item.status === 'envoyee' && item.readCount !== null);
        const reads = sent.reduce((sum, item) => sum + (item.readCount ?? 0), 0);
        const envois = sent.reduce((sum, item) => sum + item.recipientCount, 0);
        const failures = sent.reduce((sum, item) => sum + item.failedCount, 0);
        const currentMonth = monthOf(context.now().toISOString());
        return {
          items: paginate(sorted, query.page, query.pageSize),
          total: sorted.length,
          page: query.page,
          pageSize: query.pageSize,
          counts: {
            all: state.campaigns.length,
            envoyee: count('envoyee'),
            programmee: count('programmee'),
            brouillon: count('brouillon'),
          },
          stats: {
            thisMonth: state.campaigns.filter((item) => {
              const date = item.sentAt ?? item.scheduledAt;
              return date !== null && monthOf(date) === currentMonth;
            }).length,
            scheduled: count('programmee'),
            readRatePercent: envois === 0 ? null : Math.round((reads * 100) / envois),
            readSummary: `${String(reads)} lus sur ${String(envois)} envois`,
            failures,
            failureDetail: failures === 0 ? null : `${String(failures)} destinataire sans e-mail valide`,
          },
        };
      }),

    getCampaign: (id: string) => run(() => find(context, id)),

    listCampaignAudiences: () => run(() => state.audiences),

    saveCampaign: (input: SaveCampaignInput) =>
      run(() => {
        const isDraft = input.mode === 'draft';
        const parsed = campaignInputSchema.safeParse({
          audienceId: input.audienceId,
          subject: input.subject,
          body: isDraft && input.body.trim() === '' ? '(brouillon)' : input.body,
          mode: isDraft ? 'now' : input.mode,
          scheduledAt: input.scheduledAt ?? '',
          copyToHistory: input.copyToHistory,
        });
        if (!parsed.success) throw new Error('Campagne invalide.');
        assertAttachments(input.attachments);
        const audience = state.audiences.find((item) => item.id === parsed.data.audienceId);
        if (!audience) throw new Error('Destinataires introuvables.');
        if (input.mode === 'scheduled' && new Date(input.scheduledAt ?? '').getTime() <= context.now().getTime()) {
          throw new Error('La date d’envoi doit être dans le futur.');
        }
        const existing = input.id ? find(context, input.id) : null;
        if (existing?.status === 'envoyee') throw new Error('Une campagne envoyée ne peut plus être modifiée.');
        const now = context.now().toISOString();
        const next: Campaign = {
          id: existing?.id ?? context.nextId('camp'),
          title: parsed.data.subject,
          audienceId: audience.id,
          audienceLabel: audience.label,
          recipientCount: audience.count,
          status: input.mode === 'now' ? 'envoyee' : input.mode === 'scheduled' ? 'programmee' : 'brouillon',
          sentAt: input.mode === 'now' ? now : null,
          scheduledAt: input.mode === 'scheduled' ? input.scheduledAt : null,
          readCount: input.mode === 'now' ? 0 : null,
          failedCount: input.mode === 'now' ? audience.withoutEmail : 0,
          subject: parsed.data.subject,
          body: input.body,
        };
        if (existing) Object.assign(existing, next);
        else state.campaigns.push(next);
        return next;
      }),
  };
}
