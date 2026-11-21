<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support;

use App\Modules\Operations\Enums\TaskStatus;
use App\Modules\Operations\Models\ScheduledTaskRun;
use Illuminate\Console\Scheduling\Event;

/**
 * Une ligne par commande planifiée, mise à jour à chaque exécution : jamais le message d'une erreur, seulement sa classe.
 */
final class ScheduledTaskJournal
{
    public function started(Event $tache): void
    {
        ScheduledTaskRun::query()->updateOrCreate(['command' => TaskName::of($tache)], [
            'expression' => $tache->expression,
            'last_started_at' => now(),
            'last_finished_at' => null,
            'last_duration_ms' => null,
            'last_status' => TaskStatus::Running,
        ]);
    }

    public function finished(Event $tache, float $dureeSecondes): void
    {
        $ligne = ScheduledTaskRun::query()->where('command', TaskName::of($tache))->first();

        if ($ligne === null) {
            return;
        }

        $reussie = $tache->exitCode === null || $tache->exitCode === 0;
        $ligne->forceFill([
            'last_finished_at' => now(),
            'last_duration_ms' => (int) round($dureeSecondes * 1000),
            'last_status' => $reussie ? TaskStatus::Succeeded : TaskStatus::Failed,
            ...($reussie ? [] : ['last_failed_at' => now()]),
        ])->save();
    }

    public function failed(Event $tache, string $classeErreur): void
    {
        $ligne = ScheduledTaskRun::query()->where('command', TaskName::of($tache))->first();

        if ($ligne === null) {
            return;
        }

        $ligne->forceFill([
            'last_finished_at' => $ligne->last_finished_at ?? now(),
            'last_status' => TaskStatus::Failed,
            'last_failed_at' => now(),
            'last_error_class' => mb_substr($classeErreur, 0, 120),
        ])->save();
    }
}
