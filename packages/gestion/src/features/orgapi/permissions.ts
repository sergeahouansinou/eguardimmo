import type { AccessLevel, RoleMatrix } from './model';

const RANK: Record<AccessLevel, number> = { none: 0, read: 1, prepare: 2, write: 3, write_two_factor: 4 };

export function levelOf(matrix: RoleMatrix | undefined, domain: string): AccessLevel {
  const found = matrix?.domains.find((candidate) => candidate.key === domain);
  return found ? found.levels[matrix?.currentRole ?? 'accountant'] : 'none';
}

export const canRead = (matrix: RoleMatrix | undefined, domain: string): boolean => RANK[levelOf(matrix, domain)] >= RANK.read;
export const canWrite = (matrix: RoleMatrix | undefined, domain: string): boolean => RANK[levelOf(matrix, domain)] >= RANK.write;
