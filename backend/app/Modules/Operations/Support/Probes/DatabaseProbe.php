<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;
use Illuminate\Support\Facades\DB;

final class DatabaseProbe implements Probe
{
    public function key(): string
    {
        return 'database';
    }

    public function run(): ProbeResult
    {
        $debut = hrtime(true);
        DB::select('SELECT 1');
        $ms = (int) round((hrtime(true) - $debut) / 1_000_000);

        return new ProbeResult($ms > (int) config('operations.health_probe_timeout_seconds') * 1000 ? ProbeState::Unknown : ProbeState::Ok, ['latency_ms' => $ms]);
    }
}
