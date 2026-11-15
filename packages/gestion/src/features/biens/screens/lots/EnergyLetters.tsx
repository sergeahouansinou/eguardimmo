import { Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import type { Letter } from '../../schemas/common';

const tones: Record<Letter, BadgeTone> = { A: 'success', B: 'success', C: 'info', D: 'info', E: 'warning', F: 'danger', G: 'danger' };

export function EnergyLetters({ energy, ghg }: { energy: Letter; ghg: Letter }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={tones[energy]} aria-label={`DPE classe ${energy}`}>{energy}</Badge>
      <Badge tone={tones[ghg]} aria-label={`GES classe ${ghg}`}>{ghg}</Badge>
    </span>
  );
}
