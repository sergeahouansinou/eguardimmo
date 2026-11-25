<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class PlatformCampaignEstimate
{
    public function __construct(
        public int $total,
        public int $eligible,
        public int $excludedNoConsent,
        public int $excludedUnreachable,
    ) {}
}
