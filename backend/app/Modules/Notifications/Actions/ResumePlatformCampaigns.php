<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\PlatformCampaignBatches;

final readonly class ResumePlatformCampaigns
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private PlatformCampaignBatches $paquets,
        private FinalizePlatformCampaign $cloture,
    ) {}

    /**
     * Comme l'ADR 0033 : une ligne `sending` trop ancienne passe `unknown` sans renvoi ; une ligne jamais prise en charge relance son paquet.
     *
     * @return int lignes passées `unknown`
     */
    public function handle(): int
    {
        $limite = now()->subMinutes((int) config('notifications.campaigns.stale_minutes'))->format('Y-m-d H:i:s.u');
        $inconnues = 0;

        foreach ($this->campagnes->sendingIds() as $id) {
            $inconnues += PlatformCampaignDelivery::query()->where('campaign_id', $id)
                ->where('status', PlatformDeliveryStatus::Sending->value)->where('attempted_at', '<', $limite)
                ->update(['status' => PlatformDeliveryStatus::Unknown->value, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);

            $enAttente = PlatformCampaignDelivery::query()->where('campaign_id', $id)
                ->where('status', PlatformDeliveryStatus::Queued->value)->where('updated_at', '<', $limite)->exists();

            if ($enAttente) {
                $this->paquets->dispatch($id);
            }

            $this->cloture->handle($id);
        }

        return $inconnues;
    }
}
