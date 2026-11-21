<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\MandateStatus;

final readonly class MandateData
{
    /**
     * @param  string  $endDate  dernier jour du mandat, inclus
     * @param  list<string>  $unitIds  lots dont la couverture est encore ouverte
     */
    public function __construct(
        public string $id,
        public string $reference,
        public string $mandantPartyId,
        public MandateStatus $status,
        public string $startsOn,
        public string $endDate,
        public bool $isArchived,
        public array $unitIds,
    ) {}
}
