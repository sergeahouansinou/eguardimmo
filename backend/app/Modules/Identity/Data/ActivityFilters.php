<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use Carbon\CarbonImmutable;

final readonly class ActivityFilters
{
    public function __construct(
        public ?string $actorId = null,
        public ?string $subjectType = null,
        public ?string $subjectId = null,
        public ?string $actionPrefix = null,
        public ?string $organizationId = null,
        public ?string $requestId = null,
        public ?CarbonImmutable $from = null,
        public ?CarbonImmutable $to = null,
        public int $perPage = 25,
    ) {}

    /**
     * @return array<string, string>
     */
    public function toAuditMetadata(): array
    {
        return array_filter([
            'actor' => $this->actorId,
            'subject_type' => $this->subjectType,
            'subject_id' => $this->subjectId,
            'action' => $this->actionPrefix,
            'organization' => $this->organizationId,
            'request_id' => $this->requestId,
            'from' => $this->from?->toIso8601String(),
            'to' => $this->to?->toIso8601String(),
        ], fn (?string $valeur): bool => $valeur !== null);
    }
}
