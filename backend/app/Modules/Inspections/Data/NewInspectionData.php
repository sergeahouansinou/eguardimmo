<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Data;

use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use Carbon\CarbonImmutable;

final readonly class NewInspectionData
{
    /**
     * @param  list<array{name: string, capacity: string, date: string}>  $signatories
     */
    public function __construct(
        public InspectionKind $kind,
        public CarbonImmutable $performedOn,
        public InspectionPerformer $performedBy,
        public array $signatories,
        public ?bool $exitMatchesEntry,
        public string $clientId,
    ) {}
}
