<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;

/**
 * Objet et corps d'une diffusion pour une ligne d'envoi : champs de fusion remplis par les valeurs figées à l'envoi.
 */
final class CampaignMessage
{
    public function subject(Campaign $campagne, CampaignDelivery $envoi): string
    {
        return MergeFields::render($campagne->subject, $envoi->merge_values ?? []);
    }

    public function body(Campaign $campagne, CampaignDelivery $envoi): string
    {
        return PlainText::fromMarkup(MergeFields::render($campagne->body, $envoi->merge_values ?? []));
    }

    /**
     * Lien https de l'annonce dans l'espace ; null sans base https configurée, le message part alors sans lien plutôt qu'avec un lien cassé.
     */
    public function spaceLink(Campaign $campagne): ?string
    {
        $base = config('notifications.urls.'.($campagne->audience === CampaignAudience::Tenants ? 'tenant' : 'owner'));

        if (! is_string($base) || ! str_starts_with(strtolower($base), 'https://')) {
            return null;
        }

        return rtrim($base, '/').'/annonces/'.$campagne->id;
    }
}
