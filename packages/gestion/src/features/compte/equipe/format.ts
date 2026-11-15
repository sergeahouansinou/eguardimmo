import { DEMO_TODAY } from '../../outils/kit';
import { formatDate, formatTime, isoDay } from '../shared/dates';
import type { Member } from './schemas';

export function lastLoginLabel(member: Member): string {
  if (member.online) return 'En ligne';
  if (member.lastLogin === null) return 'Jamais';
  return isoDay(member.lastLogin) === DEMO_TODAY ? `Aujourd'hui, ${formatTime(member.lastLogin)}` : formatDate(member.lastLogin);
}

export function scopeLabel(member: Pick<Member, 'scope'>): string {
  return member.scope.type === 'all' ? 'Tous les biens' : member.scope.buildings.join(', ');
}
