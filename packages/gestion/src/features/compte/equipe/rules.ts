import { ROLE_LABELS } from './schemas';
import type { Member } from './schemas';

export class TeamRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamRuleError';
  }
}

export class SeatLimitError extends TeamRuleError {
  constructor(planName: string) {
    super(`Toutes les places de la formule ${planName} sont utilisées. Annulez une invitation ou changez de formule.`);
    this.name = 'SeatLimitError';
  }
}

function lastActiveAdmin(member: Member, members: readonly Member[]): boolean {
  if (member.role !== 'administrateur' || member.status !== 'actif') return false;
  return !members.some((other) => other.id !== member.id && other.status === 'actif' && (other.role === 'administrateur' || other.role === 'titulaire'));
}

export function removalBlock(member: Member, members: readonly Member[]): string | null {
  if (member.role === 'titulaire') return 'Le titulaire du compte ne peut pas être retiré.';
  if (member.self) return 'Vous ne pouvez pas vous retirer vous-même.';
  if (lastActiveAdmin(member, members)) return "L'administrateur unique ne peut pas être retiré : nommez-en un autre d'abord.";
  return null;
}

export function deactivationBlock(member: Member, members: readonly Member[]): string | null {
  const block = removalBlock(member, members);
  return block === null ? null : block.replace('retiré', 'désactivé').replace('retirer', 'désactiver');
}

export function roleChangeBlock(member: Member, members: readonly Member[]): string | null {
  if (member.role === 'titulaire') return 'Le rôle du titulaire ne peut pas être modifié.';
  if (member.self) return 'Vous ne pouvez pas modifier votre propre rôle.';
  if (lastActiveAdmin(member, members)) return "Le rôle de l'administrateur unique ne peut pas être modifié.";
  return null;
}

export function seatsUsed(members: readonly Member[]): number {
  return members.filter((member) => member.status !== 'desactive').length;
}

export function fullName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`;
}

export function roleLabel(member: Member): string {
  return ROLE_LABELS[member.role];
}
