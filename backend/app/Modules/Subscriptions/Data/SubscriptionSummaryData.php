<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Data;

use Carbon\CarbonInterface;

final readonly class SubscriptionSummaryData
{
    public function __construct(
        public string $organizationId,
        public string $planCode,
        public string $status,
        public ?CarbonInterface $trialEndsAt,
    ) {}
}
