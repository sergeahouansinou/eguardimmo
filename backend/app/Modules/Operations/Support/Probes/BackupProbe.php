<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Enums\ProbeState;
use App\Modules\Operations\Models\BackupReport;
use Illuminate\Support\Carbon;

/**
 * Alerte si la dernière sauvegarde réussie d'un type a plus de `OPERATIONS_BACKUP_MAX_AGE_HOURS` heures. Aucune preuve enregistrée :
 * `unknown`, jamais `ok`.
 */
final class BackupProbe implements Probe
{
    public function key(): string
    {
        return 'backups';
    }

    public function run(): ProbeResult
    {
        $maximum = (int) config('operations.backup_max_age_hours');
        $etat = ProbeState::Ok;
        $dernieres = [];

        foreach ([BackupKind::Database, BackupKind::Documents] as $type) {
            $dernier = BackupReport::query()->where('kind', $type)->where('succeeded', true)->max('started_at');
            $date = is_string($dernier) ? Carbon::parse($dernier) : null;
            $dernieres[$type->value] = $date?->toIso8601String();
            $etatType = match (true) {
                $date === null => ProbeState::Unknown,
                $date->lt(now()->subHours($maximum)) => ProbeState::Down,
                default => ProbeState::Ok,
            };
            $etat = $etatType->severity() > $etat->severity() ? $etatType : $etat;
        }

        return new ProbeResult($etat, ['last_success_at' => $dernieres, 'max_age_hours' => $maximum]);
    }
}
