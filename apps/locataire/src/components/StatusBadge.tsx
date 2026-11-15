import { Badge, Icon } from '@eguardimmo/ui';
import { toneBadge } from '@eguardimmo/shell';
import type { Tone } from '@eguardimmo/shell';
import type { LucideIcon } from 'lucide-react';

export function StatusBadge({ tone, icon, children }: { tone: Tone; icon?: LucideIcon; children: string }) {
  return (
    <Badge tone={toneBadge[tone]}>
      {icon ? <Icon icon={icon} size={14} /> : null}
      {children}
    </Badge>
  );
}
