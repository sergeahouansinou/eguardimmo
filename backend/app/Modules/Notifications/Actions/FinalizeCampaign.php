<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;

final readonly class FinalizeCampaign
{
    /**
     * Passe `sent` quand plus aucune ligne n'attend ; recalcule les échecs. Rejouable : seule une diffusion `sending` change de statut.
     */
    public function handle(string $campagneId): void
    {
        $this->refreshFailures($campagneId);

        $enCours = CampaignDelivery::query()->where('campaign_id', $campagneId)
            ->whereIn('status', [DeliveryStatus::Queued->value, DeliveryStatus::Sending->value])->exists();

        if (! $enCours) {
            Campaign::query()->whereKey($campagneId)->where('status', CampaignStatus::Sending->value)
                ->update(['status' => CampaignStatus::Sent->value, 'sent_at' => now()->format('Y-m-d H:i:s.u'), 'updated_at' => now()->format('Y-m-d H:i:s.u')]);
        }
    }

    public function refreshFailures(string $campagneId): void
    {
        $echecs = CampaignDelivery::query()->where('campaign_id', $campagneId)
            ->whereIn('status', array_map(fn (DeliveryStatus $statut): string => $statut->value, array_filter(DeliveryStatus::cases(), fn (DeliveryStatus $statut): bool => $statut->isFailure())))
            ->count();

        Campaign::query()->whereKey($campagneId)->update(['failed_count' => $echecs]);
    }
}
