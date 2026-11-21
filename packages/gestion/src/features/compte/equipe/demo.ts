import type { AccessLevel, RoleMatrix } from './roles';
import { RIGHT_AREAS, ROLE_RIGHTS, ROLES } from './schemas';
import type { RightLevel, Role, TeamData } from './schemas';

export const demoTeam: TeamData = {
  seatLimit: null,
  planName: 'Silver',
  twoFactorRequired: true,
  members: [
    {
      id: 'awa-diallo',
      firstName: 'Awa',
      lastName: 'Diallo',
      email: 'awa.diallo@example.com',
      role: 'titulaire',
      scope: { type: 'all' },
      twoFactor: 'activee',
      lastLogin: '2026-11-13T08:42:00+01:00',
      online: false,
      status: 'actif',
      self: false,
    },
    {
      id: 'marc-chevalier',
      firstName: 'Marc',
      lastName: 'Chevalier',
      email: 'marc.chevalier@example.com',
      role: 'administrateur',
      scope: { type: 'all' },
      twoFactor: 'activee',
      lastLogin: '2026-11-13T10:02:00+01:00',
      online: true,
      status: 'actif',
      self: true,
    },
    {
      id: 'fatou-ndiaye',
      firstName: 'Fatou',
      lastName: 'Ndiaye',
      email: 'fatou.ndiaye@example.com',
      role: 'comptable',
      scope: { type: 'all' },
      twoFactor: 'a-l-acceptation',
      lastLogin: null,
      online: false,
      status: 'invite',
      self: false,
      invitedAt: '2026-11-13T14:47:31+01:00',
    },
    {
      id: 'julien-morel',
      firstName: 'Julien',
      lastName: 'Morel',
      email: 'julien.morel@example.com',
      role: 'gestionnaire',
      scope: { type: 'selected', buildings: ['Les Tilleuls'] },
      twoFactor: 'non-activee',
      lastLogin: '2026-06-12T09:15:00+02:00',
      online: false,
      status: 'desactive',
      self: false,
    },
  ],
};

const DEMO_LEVELS: Record<RightLevel, AccessLevel> = {
  modifier: 'write',
  'modifier-2fa': 'write_two_factor',
  preparation: 'prepare',
  lecture: 'read',
  aucun: 'none',
};

export function demoRoleMatrix(currentRole: Role): RoleMatrix {
  const level = (role: Role, index: number): AccessLevel => DEMO_LEVELS[ROLE_RIGHTS[role][index] ?? 'aucun'];
  return {
    currentRole,
    domains: RIGHT_AREAS.map((label, index) => {
      const [titulaire, administrateur, gestionnaire, comptable] = ROLES.map((role) => level(role, index));
      return {
        key: label,
        label,
        levels: { titulaire: titulaire ?? 'none', administrateur: administrateur ?? 'none', gestionnaire: gestionnaire ?? 'none', comptable: comptable ?? 'none' },
        twoFactor: ROLES.some((role) => level(role, index) === 'write_two_factor'),
        highlighted: true,
      };
    }),
  };
}
