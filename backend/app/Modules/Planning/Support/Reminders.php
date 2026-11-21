<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use Carbon\CarbonImmutable;

/**
 * Instants de rappel, toujours en UTC. Un événement horodaté se rappelle `reminder_offset_minutes` avant son occurrence ; un
 * événement sur la journée, à 08:00 locales la veille, dans le fuseau de l'organisation. Une tâche se rappelle à 08:00 locales,
 * `remind_days_before` jours avant son échéance.
 */
final class Reminders
{
    public const int HEURE_LOCALE = 8;

    public const int RETARD_MAX_HEURES = 24;

    /**
     * Premier rappel strictement postérieur à `$after`, nul si la série est finie ou sans rappel.
     */
    public static function eventAfter(PlanningEvent $event, CarbonImmutable $after, string $organizationTimezone): ?ReminderSlot
    {
        if ($event->reminder_offset_minutes === null || $event->cancelled_at !== null) {
            return null;
        }

        $debut = CarbonImmutable::parse($event->starts_on->toDateString(), 'UTC');
        $fin = $event->recurrence_until === null ? null : CarbonImmutable::parse($event->recurrence_until->toDateString(), 'UTC');
        $curseur = CarbonImmutable::parse($after->setTimezone('UTC')->toDateString(), 'UTC')->subDays(2);

        for ($i = 0; $i < 8; $i++) {
            $date = Occurrences::firstOnOrAfter($debut, $event->recurrence, $fin, $curseur);

            if ($date === null) {
                return null;
            }

            $rappel = self::eventReminderAt($event, $date->toDateString(), $organizationTimezone);

            if ($rappel->greaterThan($after)) {
                return new ReminderSlot($rappel, $date->toDateString());
            }

            $curseur = $date->addDay();
        }

        return null;
    }

    public static function eventReminderAt(PlanningEvent $event, string $occurrenceOn, string $organizationTimezone): CarbonImmutable
    {
        if ($event->start_time === null || $event->timezone === null) {
            return CarbonImmutable::parse($occurrenceOn.' '.sprintf('%02d:00:00', self::HEURE_LOCALE), $organizationTimezone)->subDay()->setTimezone('UTC');
        }

        return self::startsAt($occurrenceOn, $event->start_time, $event->timezone)->subMinutes((int) $event->reminder_offset_minutes);
    }

    /**
     * Heure locale vers UTC. Une heure inexistante (passage à l'heure d'été) est avancée de la durée du saut ; une heure répétée
     * (passage à l'heure d'hiver) vaut sa seconde occurrence, celle de l'heure d'hiver (comportement de PHP, verrouillé par un test).
     */
    public static function startsAt(string $date, string $time, string $timezone): CarbonImmutable
    {
        return CarbonImmutable::parse($date.' '.substr($time, 0, 8), $timezone)->setTimezone('UTC');
    }

    public static function taskAt(string $dueOn, int $daysBefore, string $organizationTimezone): CarbonImmutable
    {
        return CarbonImmutable::parse($dueOn.' '.sprintf('%02d:00:00', self::HEURE_LOCALE), $organizationTimezone)->subDays($daysBefore)->setTimezone('UTC');
    }

    /**
     * Prochain rappel d'une tâche : un seul, à venir, tant qu'elle est ouverte.
     */
    public static function taskNext(PlanningTask $task, CarbonImmutable $now, string $organizationTimezone): ?CarbonImmutable
    {
        if ($task->remind_days_before === null || $task->status !== TaskStatus::Open) {
            return null;
        }

        $rappel = self::taskAt($task->due_on->toDateString(), $task->remind_days_before, $organizationTimezone);

        return $rappel->greaterThan($now) ? $rappel : null;
    }
}
