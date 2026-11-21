<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Events\EventReminderDue;
use App\Modules\Planning\Events\TaskReminderDue;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningEventAttendee;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Queries\DueReminders;
use App\Modules\Planning\Support\Reminders;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final readonly class SendReminders
{
    private const int MAX_PAR_ELEMENT = 100;

    public function __construct(
        private CurrentOrganization $contexte,
        private DueReminders $echus,
        private OrganizationDirectory $organisation,
    ) {}

    /**
     * Tâche de fond, toutes les 5 minutes. Chaque rappel avance `next_reminder_at` dans la même transaction que son événement : un
     * rejeu ne l'envoie pas deux fois. Un rappel en retard de plus de 24 h est sauté et journalisé, jamais envoyé tard. Une organisation
     * en échec n'arrête pas les autres.
     *
     * @return array{events: int, tasks: int, skipped: int, failures: list<string>}
     */
    public function handle(CarbonImmutable $maintenant): array
    {
        $bilan = ['events' => 0, 'tasks' => 0, 'skipped' => 0, 'failures' => []];

        foreach ($this->echus->organizations($maintenant) as $organisation) {
            try {
                $this->contexte->run($organisation, function () use ($maintenant, &$bilan): void {
                    $fuseau = $this->organisation->timezone();

                    foreach ($this->echus->eventIds($maintenant) as $id) {
                        $this->evenement($id, $maintenant, $fuseau, $bilan);
                    }

                    foreach ($this->echus->taskIds($maintenant) as $id) {
                        $this->tache($id, $maintenant, $fuseau, $bilan);
                    }
                });
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failures'][] = "{$organisation} : {$erreur->getMessage()}";
            }
        }

        return $bilan;
    }

    /**
     * @param  array{events: int, tasks: int, skipped: int, failures: list<string>}  $bilan
     */
    private function evenement(string $id, CarbonImmutable $maintenant, string $fuseau, array &$bilan): void
    {
        for ($i = 0; $i < self::MAX_PAR_ELEMENT; $i++) {
            $suite = DB::transaction(function () use ($id, $maintenant, $fuseau, &$bilan): bool {
                $evenement = PlanningEvent::query()->whereKey($id)->lockForUpdate()->first();
                $prevu = $evenement?->next_reminder_at === null ? null : CarbonImmutable::instance($evenement->next_reminder_at);

                if ($evenement === null || $prevu === null || $prevu->greaterThan($maintenant)) {
                    return false;
                }

                $creneau = Reminders::eventAfter($evenement, $prevu->subSecond(), $fuseau);

                if ($creneau === null || ! $creneau->at->equalTo($prevu)) {
                    $evenement->forceFill(['next_reminder_at' => Reminders::eventAfter($evenement, $maintenant, $fuseau)?->at])->save();

                    return false;
                }

                if ($maintenant->diffInHours($prevu, true) > Reminders::RETARD_MAX_HEURES) {
                    Log::warning('Rappel d\'événement trop tardif, sauté.', ['event_id' => $evenement->id, 'occurrence_on' => $creneau->occurrenceOn, 'due_at' => $prevu->toIso8601String()]);
                    $bilan['skipped']++;
                } else {
                    EventReminderDue::dispatch($evenement->id, $evenement->organization_id, $creneau->occurrenceOn, $this->destinataires($evenement));
                    $bilan['events']++;
                }

                $evenement->forceFill(['next_reminder_at' => Reminders::eventAfter($evenement, $prevu, $fuseau)?->at])->save();

                return true;
            });

            if (! $suite) {
                return;
            }
        }
    }

    /**
     * @param  array{events: int, tasks: int, skipped: int, failures: list<string>}  $bilan
     */
    private function tache(string $id, CarbonImmutable $maintenant, string $fuseau, array &$bilan): void
    {
        DB::transaction(function () use ($id, $maintenant, &$bilan): void {
            $tache = PlanningTask::query()->whereKey($id)->lockForUpdate()->first();
            $prevu = $tache?->next_reminder_at === null ? null : CarbonImmutable::instance($tache->next_reminder_at);

            if ($tache === null || $prevu === null || $prevu->greaterThan($maintenant)) {
                return;
            }

            if ($tache->status !== TaskStatus::Open || $tache->assignee_user_id === null) {
                $tache->forceFill(['next_reminder_at' => null])->save();

                return;
            }

            if ($maintenant->diffInHours($prevu, true) > Reminders::RETARD_MAX_HEURES) {
                Log::warning('Rappel de tâche trop tardif, sauté.', ['task_id' => $tache->id, 'due_at' => $prevu->toIso8601String()]);
                $bilan['skipped']++;
            } else {
                TaskReminderDue::dispatch($tache->id, $tache->organization_id, $tache->assignee_user_id, $tache->due_on->toDateString());
                $bilan['tasks']++;
            }

            $tache->forceFill(['next_reminder_at' => null])->save();
        });
    }

    /**
     * @return list<string>
     */
    private function destinataires(PlanningEvent $evenement): array
    {
        $membres = PlanningEventAttendee::query()->where('event_id', $evenement->id)->whereNotNull('user_id')->orderBy('id')->pluck('user_id')->all();

        return array_values(array_unique([$evenement->created_by_user_id, ...array_map(strval(...), $membres)]));
    }
}
