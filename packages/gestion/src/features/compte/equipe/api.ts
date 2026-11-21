import type { ApiClient } from '@eguardimmo/api';
import { API_ROLES, API_STATUSES, API_TWO_FACTOR, apiMemberEnvelopeSchema, apiRolesSchema, apiTeamSchema } from './apiSchemas';
import type { ApiMember, ApiRoles } from './apiSchemas';
import { DOMAIN_NOTES, SUMMARY_DOMAIN_KEYS, domainLabel } from './roleDomains';
import type { RoleMatrix } from './roles';
import { inviteSchema, roleChangeSchema, scopeSchema } from './schemas';
import type { InvitableRole, Member } from './schemas';
import type { EquipeSource } from './source';

const PLAN_NAME = 'votre formule';

const ROLE_TO_API: Record<InvitableRole, string> = { administrateur: 'admin', gestionnaire: 'manager', comptable: 'accountant' };

function toMember(member: ApiMember): Member {
  return {
    id: member.id,
    firstName: member.first_name,
    lastName: member.last_name,
    email: member.email,
    role: API_ROLES[member.role],
    scope: member.scope.type === 'selected' ? { type: 'selected', buildings: [] } : { type: 'all' },
    twoFactor: API_TWO_FACTOR[member.two_factor],
    lastLogin: member.last_login_at,
    online: false,
    status: API_STATUSES[member.status],
    self: member.self,
    ...(member.message === null ? {} : { message: member.message }),
    ...(member.invited_at === null ? {} : { invitedAt: member.invited_at }),
  };
}

export function toRoleMatrix(roles: ApiRoles): RoleMatrix {
  return {
    currentRole: API_ROLES[roles.current_role],
    domains: roles.domains.map((domain) => ({
      key: domain.key,
      label: domainLabel(domain.key),
      ...(DOMAIN_NOTES[domain.key] === undefined ? {} : { note: DOMAIN_NOTES[domain.key] }),
      levels: {
        titulaire: domain.levels.owner,
        administrateur: domain.levels.admin,
        gestionnaire: domain.levels.manager,
        comptable: domain.levels.accountant,
      },
      twoFactor: domain.two_factor,
      highlighted: SUMMARY_DOMAIN_KEYS.includes(domain.key),
    })),
  };
}

export function createApiEquipeSource(client: ApiClient, organizationId: string): EquipeSource {
  const base = `/api/v1/org/${encodeURIComponent(organizationId)}`;
  const member = async (request: Promise<unknown>): Promise<Member> => toMember(apiMemberEnvelopeSchema.parse(await request).data);

  return {
    getTeam: async () => {
      const team = apiTeamSchema.parse(await client.get(`${base}/members`));
      return { members: team.data.map(toMember), seatLimit: team.meta.seat_limit, planName: PLAN_NAME, twoFactorRequired: team.meta.two_factor_required };
    },
    getRoles: async () => toRoleMatrix(apiRolesSchema.parse(await client.get(`${base}/roles`)).data),
    invite: async (input) => {
      const data = inviteSchema.parse(input);
      const payload = {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        role: ROLE_TO_API[data.role],
        scope: data.scope,
        message: data.message === '' ? null : data.message,
      };
      return member(client.post(`${base}/members`, payload));
    },
    resendInvitation: (id) => member(client.post(`${base}/members/${encodeURIComponent(id)}/invitation`)),
    cancelInvitation: async (id) => {
      await client.delete(`${base}/members/${encodeURIComponent(id)}`);
    },
    changeRole: async (id, role) => member(client.patch(`${base}/members/${encodeURIComponent(id)}`, { role: ROLE_TO_API[roleChangeSchema.parse(role)] })),
    changeScope: async (id, scope) => {
      const payload = { scope: scopeSchema.parse(scope) };
      return member(client.patch(`${base}/members/${encodeURIComponent(id)}`, payload));
    },
    deactivate: (id) => member(client.post(`${base}/members/${encodeURIComponent(id)}/deactivation`)),
    reactivate: (id) => member(client.delete(`${base}/members/${encodeURIComponent(id)}/deactivation`)),
    remove: async (id) => {
      await client.delete(`${base}/members/${encodeURIComponent(id)}`);
    },
    setTwoFactorRequired: async (required) => {
      await client.put(`${base}/security`, { two_factor_required: required });
    },
  };
}
