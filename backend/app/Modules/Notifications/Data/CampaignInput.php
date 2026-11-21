<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\CampaignAudience;

final readonly class CampaignInput
{
    /**
     * @param  list<string>  $buildingIds
     */
    public function __construct(
        public string $subject,
        public string $body,
        public CampaignAudience $audience,
        public array $buildingIds,
        public bool $copyToHistory,
    ) {}
}
