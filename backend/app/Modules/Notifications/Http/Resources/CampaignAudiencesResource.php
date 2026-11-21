<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Enums\CampaignAudience;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Destinataires possibles d'une diffusion, calculés côté serveur : effectifs seulement, jamais une liste de personnes.
 *
 * @property array{tenants: array{count: int, without_email: int, buildings: list<array<string, mixed>>}, mandants: array{count: int, without_email: int}|null} $resource
 */
final class CampaignAudiencesResource extends JsonResource
{
    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        $liste = [['audience' => CampaignAudience::Tenants->value, 'label' => CampaignAudience::Tenants->label(), 'detail' => CampaignAudience::Tenants->detail(), ...$this->resource['tenants']]];

        if ($this->resource['mandants'] !== null) {
            $liste[] = ['audience' => CampaignAudience::Mandants->value, 'label' => CampaignAudience::Mandants->label(), 'detail' => CampaignAudience::Mandants->detail(), 'buildings' => [], ...$this->resource['mandants']];
        }

        return $liste;
    }
}
