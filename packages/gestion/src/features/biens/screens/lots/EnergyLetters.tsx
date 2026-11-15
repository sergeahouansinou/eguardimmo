import { Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import type { Letter } from '../../schemas/common';

const tones: Record<Letter, BadgeTone> = { A: 'success', B: 'success', C: 'info', D: 'info', E: 'warning', F: 'danger', G: 'danger' };

export function EnergyLetters({ energy, ghg }: { energy: Letter; ghg: Letter }) {
  return (
    <p className="flex items-center gap-2 text-caption text-fg-subtle">
      <span>Énergie</span>
      <Badge tone={tones[energy]}>{energy}</Badge>
      <span>Climat</span>
      <Badge tone={tones[ghg]}>{ghg}</Badge>
    </p>
  );
}
