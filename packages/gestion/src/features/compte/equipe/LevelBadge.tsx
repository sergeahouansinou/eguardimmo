import { Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { ACCESS_LEVEL_LABELS } from './roles';
import type { AccessLevel } from './roles';

const TONES: Record<AccessLevel, BadgeTone> = {
  none: 'neutral',
  read: 'info',
  prepare: 'warning',
  write: 'success',
  write_two_factor: 'success',
};

export function LevelBadge({ level }: { level: AccessLevel }) {
  return <Badge tone={TONES[level]}>{ACCESS_LEVEL_LABELS[level]}</Badge>;
}
