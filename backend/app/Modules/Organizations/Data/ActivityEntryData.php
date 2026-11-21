<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\ActivityType;
use Carbon\CarbonImmutable;

final readonly class ActivityEntryData
{
    /**
     * @param  'member'|'tenant'|'owner'|'support'|'system'|'other'  $actorKind
     * @param  array<string, array{old: mixed, new: mixed}>|null  $changes
     * @param  array<string, bool|int|float|string|null>|null  $metadata
     */
    public function __construct(
        public string $id,
        public CarbonImmutable $occurredAt,
        public string $action,
        public ActivityType $type,
        public string $label,
        public string $actorKind,
        public ?string $actorId,
        public ?string $actorName,
        public ?bool $actorActive,
        public ?string $subjectType,
        public ?string $subjectId,
        public ?string $ip,
        public ?string $device,
        public ?array $changes,
        public ?array $metadata,
        public ?string $reference,
    ) {}
}
