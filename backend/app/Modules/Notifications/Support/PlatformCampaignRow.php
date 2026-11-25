<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\PlatformCampaign;

final readonly class PlatformCampaignRow
{
    /**
     * @param  array<string, int>  $counts  nombre de lignes d'envoi par statut
     * @param  list<string>  $recipientEmails
     */
    public function __construct(
        public PlatformCampaign $campaign,
        public array $counts,
        public array $recipientEmails = [],
        public int $unsubscribed = 0,
    ) {}
}
