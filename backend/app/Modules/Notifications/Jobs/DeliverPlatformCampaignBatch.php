<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Actions\DeliverPlatformCampaign;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Throwable;

final class DeliverPlatformCampaignBatch implements ShouldQueue
{
    use Dispatchable;
    use Queueable;
    use RetriesWithBackoff;

    /**
     * @param  list<string>  $deliveryIds
     */
    public function __construct(
        public readonly string $campaignId,
        public readonly array $deliveryIds,
    ) {}

    public function handle(DeliverPlatformCampaign $envois): void
    {
        $envois->handle($this->campaignId, $this->deliveryIds);
    }

    public function failed(Throwable $erreur): void
    {
        Log::error('Paquet de campagne abandonné après épuisement des tentatives', ['campaign' => $this->campaignId, 'lines' => count($this->deliveryIds)]);
    }
}
