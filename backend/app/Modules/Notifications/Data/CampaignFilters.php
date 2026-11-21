<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\CampaignStatus;

final readonly class CampaignFilters
{
    /**
     * @param  'all'|'month'|'quarter'|'year'  $period
     */
    public function __construct(
        public ?CampaignStatus $status = null,
        public ?string $search = null,
        public ?string $buildingId = null,
        public string $period = 'all',
    ) {}
}
