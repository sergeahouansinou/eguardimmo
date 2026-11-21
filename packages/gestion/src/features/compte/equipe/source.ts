'use client';

import { DEMO_NOW, NotFoundError, createSourceContext, nextId, slugify, useScreenQuery, useSourceMutation } from '../../outils/kit';
import { demoRoleMatrix, demoTeam } from './demo';
import { roleMatrixSchema } from './roles';
import type { RoleMatrix } from './roles';
import { SeatLimitError, TeamRuleError, deactivationBlock, removalBlock, roleChangeBlock, seatsUsed } from './rules';
import { inviteSchema, roleChangeSchema, scopeSchema, teamSchema } from './schemas';
import type { InviteInput, InvitableRole, Member, Scope, TeamData } from './schemas';

export interface EquipeSource {
  getTeam: () => Promise<TeamData>;
  getRoles: () => Promise<RoleMatrix>;
  invite: (input: InviteInput) => Promise<Member>;
  resendInvitation: (id: string) => Promise<Member>;
  cancelInvitation: (id: string) => Promise<void>;
  changeRole: (id: string, role: InvitableRole) => Promise<Member>;
  changeScope: (id: string, scope: Scope) => Promise<Member>;
  deactivate: (id: string) => Promise<Member>;
  reactivate: (id: string) => Promise<Member>;
  remove: (id: string) => Promise<void>;
  setTwoFactorRequired: (required: boolean) => Promise<void>;
}

export function createDemoEquipeSource(initial: TeamData = demoTeam): EquipeSource {
  let team: TeamData = structuredClone(initial);

  const find = (id: string): Member => {
    const member = team.members.find((candidate) => candidate.id === id);
    if (!member) throw new NotFoundError(id);
    return member;
  };
  const patch = (id: string, changes: Partial<Member>): Member => {
    const next = { ...find(id), ...changes };
    team = { ...team, members: team.members.map((member) => (member.id === id ? next : member)) };
    return structuredClone(next);
  };
  const guard = <T>(run: () => T): Promise<T> => {
    try {
      return Promise.resolve(run());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Opération impossible'));
    }
  };
  const ensureSeat = () => {
    if (team.seatLimit !== null && seatsUsed(team.members) >= team.seatLimit) throw new SeatLimitError(team.planName);
  };

  return {
    getTeam: () => Promise.resolve(structuredClone(team)),
    getRoles: () => Promise.resolve(demoRoleMatrix(team.members.find((member) => member.self)?.role ?? 'titulaire')),
    invite: (input) =>
      guard(() => {
        const data = inviteSchema.parse(input);
        if (team.members.some((member) => member.email.toLowerCase() === data.email.toLowerCase())) {
          throw new TeamRuleError('Cette adresse e-mail est déjà membre ou invitée.');
        }
        ensureSeat();
        const created: Member = {
          id: team.members.some((member) => member.id === slugify(`${data.firstName} ${data.lastName}`))
            ? nextId('membre')
            : slugify(`${data.firstName} ${data.lastName}`),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role,
          scope: data.scope,
          twoFactor: 'a-l-acceptation',
          lastLogin: null,
          online: false,
          status: 'invite',
          self: false,
          invitedAt: DEMO_NOW,
          ...(data.message === '' ? {} : { message: data.message }),
        };
        team = { ...team, members: [...team.members, created] };
        return structuredClone(created);
      }),
    resendInvitation: (id) => guard(() => patch(id, { invitedAt: DEMO_NOW })),
    cancelInvitation: (id) =>
      guard(() => {
        if (find(id).status !== 'invite') throw new TeamRuleError("Ce membre n'a pas d'invitation en attente.");
        team = { ...team, members: team.members.filter((member) => member.id !== id) };
      }),
    changeRole: (id, role) =>
      guard(() => {
        const member = find(id);
        const block = roleChangeBlock(member, team.members);
        if (block) throw new TeamRuleError(block);
        return patch(id, { role: roleChangeSchema.parse(role) });
      }),
    changeScope: (id, scope) => guard(() => patch(id, { scope: scopeSchema.parse(scope) })),
    deactivate: (id) =>
      guard(() => {
        const block = deactivationBlock(find(id), team.members);
        if (block) throw new TeamRuleError(block);
        return patch(id, { status: 'desactive', online: false });
      }),
    reactivate: (id) =>
      guard(() => {
        if (find(id).status !== 'desactive') throw new TeamRuleError("Ce membre n'est pas désactivé.");
        ensureSeat();
        return patch(id, { status: 'actif' });
      }),
    remove: (id) =>
      guard(() => {
        const block = removalBlock(find(id), team.members);
        if (block) throw new TeamRuleError(block);
        team = { ...team, members: team.members.filter((member) => member.id !== id) };
      }),
    setTwoFactorRequired: (required) =>
      guard(() => {
        team = { ...team, twoFactorRequired: required };
      }),
  };
}

const context = createSourceContext<EquipeSource>(createDemoEquipeSource);

export const EquipeSourceProvider = context.Provider;
export const useEquipeSource = context.useSource;
export const resetEquipeDemo = context.resetDefault;

export const equipeKeys = { team: ['compte', 'equipe'] as const, roles: ['compte', 'equipe-roles'] as const };

export function useTeam() {
  const source = useEquipeSource();
  return useScreenQuery(equipeKeys.team, () => source.getTeam(), teamSchema);
}

export function useRoles() {
  const source = useEquipeSource();
  return useScreenQuery(equipeKeys.roles, () => source.getRoles(), roleMatrixSchema);
}

const invalidate = [equipeKeys.team] as const;

export function useInviteMember() {
  const source = useEquipeSource();
  return useSourceMutation((input: InviteInput) => source.invite(input), invalidate);
}

export function useTeamActions() {
  const source = useEquipeSource();
  return {
    resend: useSourceMutation((id: string) => source.resendInvitation(id), invalidate),
    cancelInvitation: useSourceMutation((id: string) => source.cancelInvitation(id), invalidate),
    changeRole: useSourceMutation((input: { id: string; role: InvitableRole }) => source.changeRole(input.id, input.role), invalidate),
    changeScope: useSourceMutation((input: { id: string; scope: Scope }) => source.changeScope(input.id, input.scope), invalidate),
    deactivate: useSourceMutation((id: string) => source.deactivate(id), invalidate),
    reactivate: useSourceMutation((id: string) => source.reactivate(id), invalidate),
    remove: useSourceMutation((id: string) => source.remove(id), invalidate),
    setTwoFactorRequired: useSourceMutation((required: boolean) => source.setTwoFactorRequired(required), invalidate),
  };
}

