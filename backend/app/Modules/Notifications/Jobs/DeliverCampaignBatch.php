<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Actions\SendCampaignDeliveries;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Un paquet de lignes d'une diffusion. Rejouable sans doublon : chaque ligne passe `queued` → `sending` par une mise à jour conditionnelle
 * avant l'appel au fournisseur.
 */
final class DeliverCampaignBatch implements ShouldQueue
{
    use Dispatchable;
    use Queueable;
    use RetriesWithBackoff;

    /**
     * @param  list<string>  $deliveryIds
     */
    public function __construct(
        public readonly string $organizationId,
        public readonly string $campaignId,
        public readonly array $deliveryIds,
    ) {}

    public function handle(CurrentOrganization $organisation, SendCampaignDeliveries $envois): void
    {
        $organisation->run($this->organizationId, fn () => $envois->handle($this->campaignId, $this->deliveryIds));
    }

    public function failed(Throwable $erreur): void
    {
        Log::error('Paquet de diffusion abandonné après épuisement des tentatives', ['campaign' => $this->campaignId, 'lines' => count($this->deliveryIds)]);
    }
}
