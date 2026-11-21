import { Badge } from '@eguardimmo/ui';
import { formatDate, formatDateTime, formatDayMonth } from '@/lib/format';
import { VERIFICATION_METHOD_LABELS, labelOf } from '@/platform/labels';
import type { PrivacyRequest } from '@/platform/privacy/privacy';
import { EmptyLine, KeyValueList, Section } from '@/ui/Section';
import { Timeline } from '@/ui/Timeline';
import { CHANNEL_LABELS, EVENT_LABELS, EVENT_TONES, EXTENSION_REASON_LABELS, REFUSAL_REASON_LABELS } from './labels';

export function RequesterSection({ request }: { request: PrivacyRequest }) {
  return (
    <Section id="demandeur" title="Demandeur">
      <KeyValueList
        items={[
          { label: 'Nom', value: request.requester.name ?? 'Non renseigné' },
          { label: 'E-mail', value: request.requester.email ?? 'Non renseigné' },
          { label: 'Compte', value: request.requester.accountId === null ? 'Aucun compte rattaché' : <span className="font-mono break-all">{request.requester.accountId}</span> },
          { label: 'Canal', value: CHANNEL_LABELS[request.channel] ?? request.channel },
        ]}
      />
    </Section>
  );
}

export function DeadlineSection({ request }: { request: PrivacyRequest }) {
  return (
    <Section id="delais" title="Délais" aside={request.overdue ? <Badge tone="danger">En retard</Badge> : undefined}>
      <KeyValueList
        items={[
          { label: 'Reçue le', value: formatDate(request.receivedAt) },
          { label: 'Échéance initiale', value: formatDate(request.dueAt) },
          {
            label: 'Prolongation',
            value: request.extendedUntil === null ? 'Aucune' : `Jusqu’au ${formatDate(request.extendedUntil)}${request.extensionReason === null ? '' : ` (${labelOf(EXTENSION_REASON_LABELS, request.extensionReason)})`}`,
          },
          { label: 'Échéance retenue', value: formatDate(request.deadline) },
          { label: 'Clôturée le', value: request.completedAt === null ? '—' : formatDate(request.completedAt) },
          ...(request.refusalReason === null ? [] : [{ label: 'Motif du refus', value: labelOf(REFUSAL_REASON_LABELS, request.refusalReason) }]),
        ]}
      />
    </Section>
  );
}

export function ComplianceSection({ request }: { request: PrivacyRequest }) {
  return (
    <Section id="conformite" title="Identité, transmissions et export">
      <KeyValueList
        items={[
          {
            label: 'Identité',
            value:
              request.identityVerifiedAt === null
                ? 'Non vérifiée'
                : `Vérifiée le ${formatDate(request.identityVerifiedAt)} (${request.identityVerifiedBy === null ? 'méthode inconnue' : labelOf(VERIFICATION_METHOD_LABELS, request.identityVerifiedBy)})`,
          },
          { label: 'Transmissions', value: `${String(request.forwards.handled)} traitée(s) sur ${String(request.forwards.total)}` },
          {
            label: 'Export des données',
            value: request.exportGenerated
              ? `Généré${request.exportExpiresAt === null ? '' : `, disponible jusqu’au ${formatDate(request.exportExpiresAt)}`} · ${request.exportDownloaded ? 'téléchargé par le demandeur' : 'pas encore téléchargé'}`
              : 'Aucun export généré',
          },
        ]}
      />
      <p className="mt-2 text-caption text-fg-subtle">L’export n’est jamais téléchargeable depuis la console : seul le demandeur y accède.</p>
    </Section>
  );
}

export function JournalSection({ request }: { request: PrivacyRequest }) {
  return (
    <Section id="journal" title="Journal de preuve">
      {request.events === null || request.events.length === 0 ? (
        <EmptyLine>Aucun événement enregistré.</EmptyLine>
      ) : (
        <Timeline
          entries={request.events.map((event, index) => ({
            id: `${event.kind}-${event.occurredAt}-${String(index)}`,
            time: formatDayMonth(event.occurredAt),
            title: EVENT_LABELS[event.kind] ?? event.kind,
            detail: `${formatDateTime(event.occurredAt)} · ${event.actorId === null ? 'Système' : `Opérateur ou compte ${event.actorId}`}`,
            tone: EVENT_TONES[event.kind] ?? 'default',
          }))}
        />
      )}
    </Section>
  );
}
