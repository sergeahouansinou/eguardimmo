<?php

declare(strict_types=1);

namespace App\Shared\Reminders;

use Carbon\CarbonImmutable;

final readonly class ReminderHit
{
    /**
     * @param  array<string, string>  $params
     */
    public function __construct(
        public string $subjectId,
        public CarbonImmutable $since,
        public ?string $accountId = null,
        public ?string $organizationId = null,
        public ?string $leaseId = null,
        public array $params = [],
    ) {}
}
