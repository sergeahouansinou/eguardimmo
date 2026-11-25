<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;

final readonly class FinalizePlatformCampaign
{
    /**
     * Passe `sent` quand plus aucune ligne n'attend. Rejouable : seule une campagne `sending` change de statut.
     */
    public function handle(string $campagneId): void
    {
        $enCours = PlatformCampaignDelivery::query()->where('campaign_id', $campagneId)
            ->whereIn('status', [PlatformDeliveryStatus::Queued->value, PlatformDeliveryStatus::Sending->value])->exists();

        if ($enCours) {
            return;
        }

        $maintenant = now()->format('Y-m-d H:i:s.u');
        PlatformCampaign::query()->whereKey($campagneId)->where('status', PlatformCampaignStatus::Sending->value)
            ->update(['status' => PlatformCampaignStatus::Sent->value, 'sent_at' => $maintenant, 'updated_at' => $maintenant]);
    }
}
