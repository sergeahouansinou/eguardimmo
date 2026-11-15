'use client';

import { Check, TriangleAlert } from 'lucide-react';
import { Icon, cx } from '@eguardimmo/ui';
import type { SurveyRoom } from './schemas';

export function roomProgress(room: SurveyRoom) {
  const done = room.elements.filter((element) => element.state !== 'non_controle').length;
  const issues = room.elements.filter((element) => element.state === 'degrade' || element.state === 'absent').length;
  return { done, total: room.elements.length, issues };
}

export function RoomNav({ rooms, selected, onSelect }: { rooms: readonly SurveyRoom[]; selected: string; onSelect: (room: string) => void }) {
  return (
    <nav aria-label="Pièces du relevé" className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {rooms.map((room) => {
        const { done, total, issues } = roomProgress(room);
        const active = room.room === selected;
        return (
          <button
            key={room.room}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => { onSelect(room.room); }}
            className={cx(
              'flex shrink-0 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-body focus-visible:outline-2 focus-visible:outline-focus',
              active ? 'bg-action-subtle font-semibold text-action-on-subtle' : 'text-fg-muted hover:bg-muted',
            )}
          >
            <span className="whitespace-nowrap">{room.room}</span>
            <span className="inline-flex items-center gap-1 text-caption tabular-nums">
              {issues > 0 ? <Icon icon={TriangleAlert} size={14} /> : null}
              {issues === 0 && done === total ? <Icon icon={Check} size={14} /> : null}
              {`${String(done)}/${String(total)}`}
              <span className="sr-only">{issues > 0 ? `, ${String(issues)} anomalie${issues > 1 ? 's' : ''}` : ''}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
