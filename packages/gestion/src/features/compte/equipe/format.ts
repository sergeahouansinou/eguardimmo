import { formatDate, formatTime, isoDay } from '../shared/dates';
import type { Member } from './schemas';

export function lastLoginLabel(member: Member, today: string): string {
  if (member.online) return 'En ligne';
  if (member.lastLogin === null) return 'Jamais';
  return isoDay(member.lastLogin) === today ? `Aujourd'hui, ${formatTime(member.lastLogin)}` : formatDate(member.lastLogin);
}

export function scopeLabel(member: Pick<Member, 'scope'>): string {
  if (member.scope.type === 'all') return 'Tous les biens';
  const names = member.scope.buildings.join(', ');
  return names === '' ? 'Périmètre non appliqué' : `${names} (périmètre non appliqué)`;
}
