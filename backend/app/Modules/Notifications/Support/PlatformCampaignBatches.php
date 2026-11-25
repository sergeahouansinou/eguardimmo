<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Jobs\DeliverPlatformCampaignBatch;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use Illuminate\Support\Facades\DB;

final class PlatformCampaignBatches
{
    /**
     * Un job par paquet de lignes en attente, après la validation de la transaction en cours.
     */
    public function dispatch(string $campagneId): void
    {
        $identifiants = PlatformCampaignDelivery::query()->where('campaign_id', $campagneId)
            ->where('status', PlatformDeliveryStatus::Queued->value)->orderBy('id')->pluck('id')->all();

        DB::afterCommit(function () use ($campagneId, $identifiants): void {
            foreach (array_chunk($identifiants, max(1, (int) config('notifications.campaigns.batch_size'))) as $paquet) {
                DeliverPlatformCampaignBatch::dispatch($campagneId, $paquet);
            }
        });
    }
}
