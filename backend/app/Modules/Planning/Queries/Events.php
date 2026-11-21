<?php

declare(strict_types=1);

namespace App\Modules\Planning\Queries;

use App\Modules\Planning\Data\EventViewData;
use App\Modules\Planning\Data\OccurrenceData;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\Recurrence;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningEventAttendee;
use App\Modules\Planning\Support\Occurrences;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class Events
{
    public const int FENETRE_MAX_JOURS = 62;

    public const int OCCURRENCES_MAX = 500;

    public function get(string $id): PlanningEvent
    {
        return (Str::isUuid($id) ? PlanningEvent::query()->find($id) : null) ?? throw ErrorCode::EventNotFound->problem();
    }

    public function view(string $id): EventViewData
    {
        return $this->data($this->get($id));
    }

    public function data(PlanningEvent $evenement): EventViewData
    {
        $participants = PlanningEventAttendee::query()->where('event_id', $evenement->id)->orderBy('id')->get(['user_id', 'party_id']);

        return new EventViewData(
            $evenement->id,
            $evenement->kind,
            $evenement->title,
            $evenement->notes,
            $evenement->starts_on->toDateString(),
            $evenement->start_time === null ? null : substr($evenement->start_time, 0, 5),
            $evenement->timezone,
            $evenement->recurrence,
            $evenement->recurrence_until?->toDateString(),
            $evenement->reminder_offset_minutes,
            $evenement->property_id,
            $evenement->unit_id,
            $evenement->lease_id,
            array_values($participants->map(fn (PlanningEventAttendee $p): array => ['user_id' => $p->user_id, 'party_id' => $p->party_id])->all()),
            $evenement->created_by_user_id,
            $evenement->cancelled_at,
            $evenement->lock_version,
        );
    }

    /**
     * Occurrences dans [from, to) des événements non annulés. Au-delà de 500 occurrences, la période est refusée plutôt que tronquée.
     *
     * @return list<OccurrenceData>
     */
    public function occurrences(CarbonImmutable $from, CarbonImmutable $to): array
    {
        if ($from->diffInDays($to) > self::FENETRE_MAX_JOURS) {
            throw ErrorCode::RangeTooWide->problem();
        }

        $requete = PlanningEvent::query()
            ->whereNull('cancelled_at')
            ->where('starts_on', '<', $to->toDateString())
            ->where(function (Builder $q) use ($from): void {
                $q->where(fn (Builder $s) => $s->where('recurrence', Recurrence::None->value)->where('starts_on', '>=', $from->toDateString()))
                    ->orWhere(fn (Builder $r) => $r->where('recurrence', '!=', Recurrence::None->value)
                        ->where(fn (Builder $u) => $u->whereNull('recurrence_until')->orWhere('recurrence_until', '>=', $from->toDateString())));
            });

        $liste = [];

        foreach ($requete->orderBy('starts_on')->orderBy('id')->cursor() as $evenement) {
            $debut = CarbonImmutable::parse($evenement->starts_on->toDateString(), 'UTC');
            $fin = $evenement->recurrence_until === null ? null : CarbonImmutable::parse($evenement->recurrence_until->toDateString(), 'UTC');

            foreach (Occurrences::between($debut, $evenement->recurrence, $fin, $from, $to, self::OCCURRENCES_MAX) as $date) {
                $liste[] = $this->occurrence($evenement, $date->toDateString());

                if (count($liste) > self::OCCURRENCES_MAX) {
                    throw ErrorCode::RangeTooWide->problem();
                }
            }
        }

        usort($liste, fn (OccurrenceData $a, OccurrenceData $b): int => [$a->occurrenceOn, $a->startTime ?? '', $a->eventId] <=> [$b->occurrenceOn, $b->startTime ?? '', $b->eventId]);

        return $liste;
    }

    private function occurrence(PlanningEvent $evenement, string $date): OccurrenceData
    {
        $horodate = $evenement->start_time !== null && $evenement->timezone !== null;

        return new OccurrenceData(
            $evenement->id,
            $date,
            $evenement->kind,
            $evenement->title,
            $evenement->start_time === null ? null : substr($evenement->start_time, 0, 5),
            $evenement->timezone,
            $horodate ? Reminders::startsAt($date, (string) $evenement->start_time, (string) $evenement->timezone) : null,
            $evenement->recurrence,
            $evenement->property_id,
            $evenement->unit_id,
            $evenement->lease_id,
        );
    }
}
