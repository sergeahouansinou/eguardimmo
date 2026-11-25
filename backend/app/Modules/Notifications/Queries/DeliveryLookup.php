<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Str;

/**
 * Retrouve la ligne d'un envoi sans contexte d'organisation (lien de désinscription, webhook du fournisseur) : l'appelant la lit pour y
 * poser le contexte de son organisation, jamais pour la renvoyer telle quelle. Un envoi de la plateforme n'a pas d'organisation (ADR 0042).
 */
final class DeliveryLookup
{
    /**
     * @return array{id: string, organization_id: string|null, campaign_id: string, email_hash: string|null}|null
     */
    public function byId(string $id): ?array
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return $this->shape(AcrossOrganizations::query(CampaignDelivery::class)->whereKey($id)->first()
            ?? PlatformCampaignDelivery::query()->whereKey($id)->first());
    }

    /**
     * @return array{id: string, organization_id: string|null, campaign_id: string, email_hash: string|null}|null
     */
    public function byProviderMessage(string $messageId): ?array
    {
        return $this->shape(AcrossOrganizations::query(CampaignDelivery::class)->where('provider_message_id', $messageId)->first()
            ?? PlatformCampaignDelivery::query()->where('provider_message_id', $messageId)->first());
    }

    /**
     * @return array{id: string, organization_id: string|null, campaign_id: string, email_hash: string|null}|null
     */
    private function shape(CampaignDelivery|PlatformCampaignDelivery|null $envoi): ?array
    {
        return $envoi === null ? null : [
            'id' => $envoi->id,
            'organization_id' => $envoi instanceof CampaignDelivery ? $envoi->organization_id : null,
            'campaign_id' => $envoi->campaign_id,
            'email_hash' => $envoi->email_hash,
        ];
    }
}
