<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

/**
 * Lectures des tâches planifiées, toutes organisations confondues : elles ne rendent que des identifiants, chaque suite se joue sous le
 * contexte de l'organisation de la diffusion.
 */
final class CampaignRuns
{
    /**
     * @return list<array{id: string, organization_id: string, sent_by_user_id: string}>
     */
    public function due(): array
    {
        return array_values(AcrossOrganizations::query(Campaign::class)
            ->where('status', CampaignStatus::Scheduled->value)
            ->where('scheduled_at', '<=', now()->format('Y-m-d H:i:s.u'))
            ->whereNotNull('sent_by_user_id')
            ->orderBy('scheduled_at')->orderBy('id')
            ->get(['id', 'organization_id', 'sent_by_user_id'])
            ->map(fn (Campaign $c): array => ['id' => $c->id, 'organization_id' => $c->organization_id, 'sent_by_user_id' => (string) $c->sent_by_user_id])
            ->all());
    }

    /**
     * @return list<array{id: string, organization_id: string}>
     */
    public function sending(): array
    {
        return array_values(AcrossOrganizations::query(Campaign::class)
            ->where('status', CampaignStatus::Sending->value)
            ->orderBy('id')
            ->get(['id', 'organization_id'])
            ->map(fn (Campaign $c): array => ['id' => $c->id, 'organization_id' => $c->organization_id])
            ->all());
    }

    /**
     * @return list<array{id: string, organization_id: string}>
     */
    public function contentExpired(CarbonImmutable $avant): array
    {
        return array_values(AcrossOrganizations::query(Campaign::class)
            ->whereNull('content_purged_at')
            ->where('created_at', '<', $avant->format('Y-m-d H:i:s.u'))
            ->whereIn('status', [CampaignStatus::Sent->value, CampaignStatus::Cancelled->value, CampaignStatus::Draft->value])
            ->orderBy('id')
            ->get(['id', 'organization_id'])
            ->map(fn (Campaign $c): array => ['id' => $c->id, 'organization_id' => $c->organization_id])
            ->all());
    }

    /**
     * @return list<string> organisations qui ont des adresses d'envoi à remplacer par leur empreinte
     */
    public function organizationsWithExpiredAddresses(CarbonImmutable $avant): array
    {
        return array_values(array_unique(AcrossOrganizations::query(CampaignDelivery::class)
            ->whereNotNull('email')
            ->where('created_at', '<', $avant->format('Y-m-d H:i:s.u'))
            ->distinct()
            ->pluck('organization_id')
            ->all()));
    }
}
