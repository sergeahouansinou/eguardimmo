<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class MandantData
{
    public function __construct(
        public string $partyId,
        public string $displayName,
        public int $mandateCount,
        public int $runningMandateCount,
    ) {}
}
