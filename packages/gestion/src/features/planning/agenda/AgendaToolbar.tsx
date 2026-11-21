'use client';

import { Button, Chip, Icon, SegmentedControl } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AGENDA_VIEWS } from './calendar';
import type { AgendaView } from './calendar';
import { SOURCE_LABELS } from './labels';
import type { AgendaSource } from './labels';

const VIEW_LABELS: Readonly<Record<AgendaView, string>> = { mois: 'Mois', semaine: 'Semaine', jour: 'Jour' };
const SOURCES = Object.keys(SOURCE_LABELS) as AgendaSource[];

export interface AgendaToolbarProps {
  view: AgendaView;
  title: string;
  enabled: ReadonlySet<AgendaSource>;
  onView: (view: AgendaView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggle: (source: AgendaSource) => void;
}

export function AgendaToolbar({ view, title, enabled, onView, onPrevious, onNext, onToday, onToggle }: AgendaToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onPrevious} aria-label="Période précédente" className="min-w-7 px-1.5">
            <Icon icon={ChevronLeft} />
          </Button>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label="Période suivante" className="min-w-7 px-1.5">
            <Icon icon={ChevronRight} />
          </Button>
          <Button variant="secondary" size="sm" onClick={onToday}>Aujourd’hui</Button>
          <h2 aria-live="polite" className="text-section-title">{title}</h2>
        </div>
        <SegmentedControl label="Affichage" options={AGENDA_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))} value={view} onValueChange={(value) => { onView(AGENDA_VIEWS.find((candidate) => candidate === value) ?? 'mois'); }} />
      </div>
      <div role="group" aria-label="Éléments affichés" className="flex flex-wrap gap-2">
        {SOURCES.map((source) => (
          <Chip key={source} pressed={enabled.has(source)} onClick={() => { onToggle(source); }}>
            {SOURCE_LABELS[source]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
