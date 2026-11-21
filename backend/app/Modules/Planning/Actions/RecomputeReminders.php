<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Support\Reminders;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RecomputeReminders
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Après un changement de fuseau de l'organisation : les tâches ouvertes et les événements sur la journée entière se rappellent à
     * 08:00 locales ; les événements horodatés gardent le fuseau copié à leur création et ne bougent pas. Sous le contexte de l'organisation.
     *
     * @return array{tasks: int, events: int} éléments dont le prochain rappel a changé
     */
    public function handle(string $timezone): array
    {
        $maintenant = CarbonImmutable::now();

        return DB::transaction(function () use ($timezone, $maintenant): array {
            $taches = 0;
            $evenements = 0;

            foreach (PlanningTask::query()->where('status', TaskStatus::Open->value)->whereNotNull('remind_days_before')->lazyById(200) as $tache) {
                $suivant = Reminders::taskNext($tache, $maintenant, $timezone);

                if ($tache->next_reminder_at?->toIso8601String() !== $suivant?->toIso8601String()) {
                    $tache->forceFill(['next_reminder_at' => $suivant])->save();
                    $taches++;
                }
            }

            foreach (PlanningEvent::query()->whereNull('cancelled_at')->whereNull('start_time')->whereNotNull('reminder_offset_minutes')->lazyById(200) as $evenement) {
                $suivant = Reminders::eventAfter($evenement, $maintenant, $timezone)?->at;

                if ($evenement->next_reminder_at?->toIso8601String() !== $suivant?->toIso8601String()) {
                    $evenement->forceFill(['next_reminder_at' => $suivant])->save();
                    $evenements++;
                }
            }

            $this->audit->handle('planning.reminders.recomputed', metadata: ['tasks' => $taches, 'events' => $evenements, 'timezone' => $timezone]);

            return ['tasks' => $taches, 'events' => $evenements];
        });
    }
}
