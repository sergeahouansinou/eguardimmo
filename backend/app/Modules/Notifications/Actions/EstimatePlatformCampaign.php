<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PlatformCampaignEstimate;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\PlatformRecipients;

final readonly class EstimatePlatformCampaign
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private PlatformRecipients $destinataires,
    ) {}

    public function handle(string $campagneId): PlatformCampaignEstimate
    {
        $campagne = $this->campagnes->find($campagneId);
        $total = 0;
        $joignables = 0;
        $sansAccord = 0;

        foreach ($this->destinataires->chunks($campagne) as $comptes) {
            foreach ($this->destinataires->classify($campagne, $comptes) as $verdict) {
                $total++;
                $joignables += $verdict['status'] === PlatformDeliveryStatus::Queued ? 1 : 0;
                $sansAccord += $verdict['error'] === 'no_consent' ? 1 : 0;
            }
        }

        return new PlatformCampaignEstimate($total, $joignables, $sansAccord, $total - $joignables - $sansAccord);
    }
}
