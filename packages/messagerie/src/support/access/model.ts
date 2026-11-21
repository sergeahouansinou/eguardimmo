import type { StaffRole } from '../../external/staff/model';

export type AccessKind = 'consent' | 'emergency';
export type AccessStatus = 'requested' | 'active' | 'refused' | 'revoked' | 'expired';
export type AccessScope = 'settings' | 'team' | 'records' | 'documents';
export type EmergencyBasis = 'security_incident' | 'legal_requisition';

export const ACCESS_SCOPES: readonly AccessScope[] = ['settings', 'team', 'records', 'documents'];
export const MIN_ACCESS_HOURS = 1;
export const MAX_ACCESS_HOURS = 72;
export const DEFAULT_ACCESS_HOURS = 24;

export interface AccessGrant {
  id: string;
  kind: AccessKind;
  status: AccessStatus;
  scopes: AccessScope[];
  reason: string;
  emergencyBasis: EmergencyBasis | null;
  ticketReference: string;
  operator: string;
  durationHours: number | null;
  requestedAt: string | null;
  decidedAt: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  reviewed: boolean;
  readCount: number;
}

export interface AccessPage {
  items: AccessGrant[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface AcceptAccessInput {
  durationHours: number;
  scopes: AccessScope[];
}

export interface AccessRoutes {
  access: string;
}

export function canManageAccess(role: StaffRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isLive(grant: AccessGrant): boolean {
  return grant.status === 'active';
}

export function isEmergencyOpen(grant: AccessGrant): boolean {
  return grant.kind === 'emergency' && grant.status === 'active';
}
