<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * File d'attente : retard de la plus ancienne tâche par file (pilote `database`) et échecs des dernières 24 heures. Un autre pilote ne
 * laisse pas lire le retard : l'état est `unknown`.
 */
final class QueueProbe implements Probe
{
    public function key(): string
    {
        return 'queue';
    }

    public function run(): ProbeResult
    {
        $connexion = (string) config('queue.default');
        $pilote = (string) config("queue.connections.{$connexion}.driver", $connexion);
        $echecs = Schema::hasTable('failed_jobs')
            ? DB::table('failed_jobs')->whereRaw('failed_at >= ?', [now()->subDay()->format('Y-m-d H:i:s')])->count()
            : null;

        if ($pilote !== 'database' || ! Schema::hasTable('jobs')) {
            return new ProbeResult(ProbeState::Unknown, ['driver' => $pilote, 'queues' => [], 'failed_24h' => $echecs]);
        }

        $files = DB::table('jobs')->selectRaw('queue, COUNT(*) AS en_attente, MIN(created_at) AS plus_ancienne')->groupBy('queue')->orderBy('queue')->get();
        $maximum = (int) config('operations.queue_max_age_seconds');
        $retard = false;
        $detail = [];

        foreach ($files as $file) {
            $age = max(0, now()->getTimestamp() - (int) $file->plus_ancienne);
            $retard = $retard || $age > $maximum;
            $detail[] = ['queue' => (string) $file->queue, 'pending' => (int) $file->en_attente, 'oldest_age_seconds' => $age];
        }

        return new ProbeResult($retard ? ProbeState::Down : ProbeState::Ok, ['driver' => $pilote, 'queues' => $detail, 'failed_24h' => $echecs]);
    }
}
