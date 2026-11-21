<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Parties\Data\PartyData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Relation de travail seulement : l'identité vient de Parties, aucune coordonnée bancaire n'est servie ici.
 *
 * @property SupplierProfile $resource
 */
final class SupplierResource extends JsonResource
{
    public function __construct(SupplierProfile $profil, private readonly ?PartyData $partie = null)
    {
        parent::__construct($profil);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $s = $this->resource;

        return [
            'id' => $s->id,
            'party' => ['id' => $s->party_id, 'name' => $this->partie?->displayName, 'is_anonymized' => $this->partie?->isAnonymized],
            'status' => $s->status->value,
            'preferred' => $s->preferred,
            'payment_terms_days' => $s->payment_terms_days,
            'internal_note' => $s->internal_note,
            'trade_term_ids' => $s->relationLoaded('trades') ? $s->trades->map(fn ($t): string => $t->nature_term_id)->values()->all() : [],
            'custom_fields' => $s->custom_fields,
            'lock_version' => $s->lock_version,
        ];
    }
}
