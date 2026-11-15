<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Parties\Models\PartyIdentifier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Une pièce d'identité ne se relit pas en entier : seuls les quatre derniers caractères sortent.
 *
 * @property PartyIdentifier $resource
 */
final class IdentifierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $valeur = $this->resource->value;
        $personnel = $this->resource->scheme->isPersonal();

        return [
            'id' => $this->resource->id,
            'scheme' => $this->resource->scheme->value,
            'country' => $this->resource->country,
            'value' => $personnel ? null : $valeur,
            'last4' => $valeur === null ? null : substr($valeur, -4),
        ];
    }
}
