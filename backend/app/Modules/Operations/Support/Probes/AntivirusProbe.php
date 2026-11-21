<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Documents\PublicApi\ScannerStatus;
use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;

final readonly class AntivirusProbe implements Probe
{
    public function __construct(private ScannerStatus $analyseur) {}

    public function key(): string
    {
        return 'antivirus';
    }

    public function run(): ProbeResult
    {
        $etat = $this->analyseur->probe((int) config('operations.health_probe_timeout_seconds'));

        return new ProbeResult(ProbeState::from($etat->state), ['enabled' => $etat->enabled, 'latency_ms' => $etat->latencyMs]);
    }
}
