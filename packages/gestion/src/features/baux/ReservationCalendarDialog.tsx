'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent, IconButton, Select } from '@eguardimmo/ui';
import { useState } from 'react';
import type { Reservation } from './schemas';
import { addDays, addMonths, formatDateFr, monthLabel, todayIso } from '../locataires/kit/dates';

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

function monthDays(month: string): string[] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const total = Math.round((new Date(`${addMonths(first, 1)}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000);
  const days: string[] = Array.from({ length: weekday }, () => '');
  for (let day = 0; day < total; day += 1) days.push(addDays(first, day));
  return days;
}

export function ReservationCalendarDialog({
  open,
  onOpenChange,
  reservations,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservations: readonly Reservation[];
  units: readonly { id: string; label: string }[];
}) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [unitId, setUnitId] = useState('');
  const chosen = unitId === '' ? (units[0]?.id ?? '') : unitId;
  const active = reservations.filter((item) => item.unitId === chosen && item.status !== 'annulee');
  const bookingOf = (day: string) => active.find((item) => item.arrival <= day && day < item.departure);
  const monthly = active.filter((item) => item.arrival.slice(0, 7) <= month && addDays(item.departure, -1).slice(0, 7) >= month);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Calendrier des réservations" description="Les nuits réservées sont signalées pour le bien choisi.">
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Select
              label="Bien"
              hideLabel
              placeholder="Choisir un bien"
              value={chosen}
              onValueChange={setUnitId}
              options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
              className="w-48"
            />
            <div className="flex items-center gap-1">
              <IconButton label="Mois précédent" icon={ChevronLeft} onClick={() => { setMonth(addMonths(`${month}-01`, -1).slice(0, 7)); }} />
              <span className="min-w-32 text-center text-body-strong" aria-live="polite">{monthLabel(month)}</span>
              <IconButton label="Mois suivant" icon={ChevronRight} onClick={() => { setMonth(addMonths(`${month}-01`, 1).slice(0, 7)); }} />
            </div>
          </div>
          <div role="grid" aria-label={`Nuits réservées, ${monthLabel(month)}`} className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} role="columnheader" className="text-caption text-fg-subtle">{weekday}</span>
            ))}
            {monthDays(month).map((day, index) => {
              if (day === '') return <span key={`vide-${String(index)}`} aria-hidden="true" />;
              const booking = bookingOf(day);
              return (
                <span
                  key={day}
                  role="gridcell"
                  aria-label={booking ? `${formatDateFr(day)}, réservé par ${booking.guest}` : `${formatDateFr(day)}, libre`}
                  className={booking ? 'rounded-sm bg-action-subtle py-1 text-body-strong text-action-on-subtle' : 'rounded-sm py-1 text-body text-fg-muted'}
                >
                  {Number(day.slice(8))}
                </span>
              );
            })}
          </div>
          {monthly.length === 0 ? (
            <p className="text-body text-fg-subtle">Aucune réservation ce mois-ci pour ce bien.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {monthly.map((item) => (
                <li key={item.id} className="text-body text-fg-muted">{`${item.reference}, ${item.guest} : ${formatDateFr(item.arrival)} → ${formatDateFr(item.departure)}`}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
