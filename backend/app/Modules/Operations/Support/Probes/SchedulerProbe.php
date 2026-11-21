<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;
use App\Modules\Operations\Enums\TaskStatus;
use App\Modules\Operations\Models\ScheduledTaskRun;
use Cron\CronExpression;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Tâches planifiées : dernière exécution, durée, échec et retard sur la fréquence que le planificateur a lui-même déclarée. Sans aucune
 * exécution enregistrée, rien ne prouve que le planificateur tourne : `unknown`.
 */
final class SchedulerProbe implements Probe
{
    private const TOLERANCE_MINUTES = 10;

    public function key(): string
    {
        return 'scheduler';
    }

    public function run(): ProbeResult
    {
        $lignes = ScheduledTaskRun::query()->orderBy('command')->get();

        if ($lignes->isEmpty()) {
            return new ProbeResult(ProbeState::Unknown, ['tasks' => []]);
        }

        $problemes = false;
        $taches = [];

        foreach ($lignes as $ligne) {
            $enRetard = $this->enRetard($ligne);
            $echec = $ligne->last_status === TaskStatus::Failed;
            $problemes = $problemes || $enRetard || $echec;
            $taches[] = [
                'command' => $ligne->command,
                'status' => $ligne->last_status->value,
                'last_started_at' => $ligne->last_started_at->toIso8601String(),
                'last_finished_at' => $ligne->last_finished_at?->toIso8601String(),
                'duration_ms' => $ligne->last_duration_ms,
                'last_failed_at' => $ligne->last_failed_at?->toIso8601String(),
                'late' => $enRetard,
            ];
        }

        return new ProbeResult($problemes ? ProbeState::Down : ProbeState::Ok, ['tasks' => $taches]);
    }

    private function enRetard(ScheduledTaskRun $ligne): bool
    {
        try {
            $attendue = Carbon::instance(CronExpression::factory($ligne->expression)->getPreviousRunDate(now()->toDateTime()));
        } catch (Throwable) {
            return false;
        }

        return $ligne->last_started_at->lt($attendue->subMinutes(self::TOLERANCE_MINUTES)) && now()->gt($attendue->addMinutes(self::TOLERANCE_MINUTES));
    }
}
