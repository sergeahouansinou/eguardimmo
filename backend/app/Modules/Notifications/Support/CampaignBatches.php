<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Jobs\DeliverCampaignBatch;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use Illuminate\Support\Facades\DB;

/**
 * Découpe les lignes d'une diffusion en paquets de 100 et lance un job par paquet, après la validation de la transaction en cours.
 */
final class CampaignBatches
{
    /**
     * @param  list<string>|null  $only  restreint à ces lignes ; null : toutes
     */
    public function dispatch(Campaign $campagne, ?array $only = null): void
    {
        $organisation = $campagne->organization_id;
        $identifiants = $only ?? CampaignDelivery::query()->where('campaign_id', $campagne->id)->orderBy('id')->pluck('id')->all();

        DB::afterCommit(function () use ($organisation, $campagne, $identifiants): void {
            foreach (array_chunk($identifiants, max(1, (int) config('notifications.campaigns.batch_size'))) as $paquet) {
                DeliverCampaignBatch::dispatch($organisation, $campagne->id, $paquet);
            }
        });
    }
}
