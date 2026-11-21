<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

final readonly class ComputedReport
{
    /**
     * @param  array<string, mixed>  $snapshot
     * @param  array<string, mixed>  $cutoff
     */
    public function __construct(
        public LedgerFigures $figures,
        public array $snapshot,
        public array $cutoff,
        public string $fingerprint,
        public string $templateVersion,
    ) {}
}
