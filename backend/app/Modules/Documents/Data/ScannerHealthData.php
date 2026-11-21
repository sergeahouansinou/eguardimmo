<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

final readonly class ScannerHealthData
{
    /**
     * @param  'ok'|'down'|'unknown'  $state
     */
    public function __construct(
        public bool $enabled,
        public string $driver,
        public string $state,
        public ?int $latencyMs,
    ) {}
}
