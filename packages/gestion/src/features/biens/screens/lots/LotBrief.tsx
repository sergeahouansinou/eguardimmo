import { Icon } from '@eguardimmo/ui';
import { ArrowUpDown, Calendar, DoorOpen, KeyRound, Ruler, Scan, Wallet, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney } from '../../../../format/money';
import { Panel } from '../../components/Panels';
import { formatArea } from '../../lib/amount';
import type { LotDetail } from '../../schemas/lots';
import { EnergyLetters } from './EnergyLetters';

interface Fact {
  icon: LucideIcon;
  label: string;
  value: string;
}

function factsOf(lot: LotDetail): Fact[] {
  const { brief } = lot;
  return [
    { icon: Ruler, label: 'Surface habitable', value: brief.habitableArea === null ? 'Non renseignée' : formatArea(brief.habitableArea) },
    ...(brief.carrezArea ? [{ icon: Scan, label: 'Surface Carrez', value: formatArea(brief.carrezArea) }] : []),
    { icon: DoorOpen, label: 'Pièces', value: brief.rooms },
    { icon: ArrowUpDown, label: 'Étage', value: brief.floor },
    ...(brief.builtYear ? [{ icon: Calendar, label: 'Construction', value: String(brief.builtYear) }] : []),
    ...(brief.rental === null ? [] : [{ icon: KeyRound, label: 'Location', value: brief.rental }]),
    ...(brief.rentCc === null ? [] : [{ icon: Wallet, label: 'Loyer charges comprises', value: formatMoney(brief.rentCc, lot.currency) }]),
  ];
}

function FactItem({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="relative min-w-0 pl-6">
      <dt className="text-caption text-fg-subtle">
        <Icon icon={icon} size={16} className="absolute left-0 top-0.5 text-brand" />
        {label}
      </dt>
      <dd className="text-body font-semibold text-fg">{children}</dd>
    </div>
  );
}

export function LotBrief({ lot }: { lot: LotDetail }) {
  const dpe = lot.brief.dpe;
  return (
    <Panel title="En bref">
      <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[420px]:grid-cols-2">
        {factsOf(lot).map((fact) => (
          <FactItem key={fact.label} icon={fact.icon} label={fact.label}>
            {fact.value}
          </FactItem>
        ))}
        {dpe ? (
          <FactItem icon={Zap} label="DPE et GES">
            <EnergyLetters energy={dpe.energy} ghg={dpe.ghg} />
          </FactItem>
        ) : null}
      </dl>
    </Panel>
  );
}
