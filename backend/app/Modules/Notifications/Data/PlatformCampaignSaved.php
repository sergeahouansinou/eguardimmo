<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class PlatformCampaignSaved
{
    /**
     * @param  list<string>  $unknownRecipients  adresses saisies sans compte joignable
     */
    public function __construct(
        public string $campaignId,
        public array $unknownRecipients,
    ) {}
}
