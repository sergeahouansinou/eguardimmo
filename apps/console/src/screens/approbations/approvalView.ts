import type { Approval } from '@/platform/approvals/approvals';
import { SUSPENSION_REASON_LABELS, VERIFICATION_METHOD_LABELS } from '@/platform/labels';
import { OVERRIDE_REASON_LABELS } from '@/screens/organisations/labels';

export interface SubjectLink {
  href: string;
  label: string;
}

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  organization: 'Organisation',
  user: 'Compte',
  privacy_request: 'Demande RGPD',
  plan_version: 'Version de plan',
  entitlement_override: 'Dérogation',
};

const PAYLOAD_KEY_LABELS: Record<string, string> = {
  reason_code: 'Motif',
  verification_method: 'Vérification d’identité',
  feature: 'Fonction',
  enabled: 'Activée',
  ends_at: 'Fin',
  limit_value: 'Limite',
  plan: 'Plan',
  version: 'Version',
  content_sha256: 'Empreinte du contenu (SHA-256)',
  kind: 'Type',
};

const FAILURE_MESSAGES: Record<string, string> = {
  approval_stale: 'La situation a changé : rien n’a été modifié. Déposez une nouvelle demande si l’action reste utile.',
  approval_expired: 'La demande a expiré avant d’être traitée.',
};

export const subjectTypeLabel = (type: string): string => SUBJECT_TYPE_LABELS[type] ?? type;

export const payloadKeyLabel = (key: string): string => PAYLOAD_KEY_LABELS[key] ?? key;

export function payloadValueLabel(key: string, value: string): string {
  if (key === 'reason_code') return SUSPENSION_REASON_LABELS[value] ?? OVERRIDE_REASON_LABELS[value] ?? value;
  if (key === 'verification_method') return VERIFICATION_METHOD_LABELS[value] ?? value;
  return value;
}

export function subjectLink(approval: Approval): SubjectLink | null {
  const id = encodeURIComponent(approval.subjectId);
  switch (approval.subjectType) {
    case 'organization':
      return { href: `/organisations/${id}`, label: 'Voir l’organisation' };
    case 'user':
      return { href: `/comptes/${id}`, label: 'Voir le compte' };
    case 'privacy_request':
      return { href: `/rgpd/${id}`, label: 'Voir la demande' };
    case 'plan_version':
      return { href: '/abonnements', label: 'Voir les plans' };
    case 'entitlement_override':
      return approval.organizationId === null ? null : { href: `/organisations/${encodeURIComponent(approval.organizationId)}`, label: 'Voir l’organisation' };
    default:
      return null;
  }
}

export function failureMessage(code: string | null): string | null {
  if (code === null) return null;
  return FAILURE_MESSAGES[code] ?? `L’exécution a échoué (${code}). Rien n’a été modifié.`;
}

export function isOwnPending(approval: Approval, operatorId: string | undefined): boolean {
  return approval.status === 'pending' && !approval.canDecide && operatorId !== undefined && approval.requestedBy.id === operatorId;
}
