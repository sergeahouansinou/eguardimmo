<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Data\OwnerVisibleData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Une entrée du sélecteur d'agence : jamais de total entre deux agences, jamais l'identifiant d'une fiche.
 *
 * @property array{visible: OwnerVisibleData, agency_name: string|null} $resource
 */
final class OwnerAgencyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $visible = $this->resource['visible'];

        return [
            'access_id' => $visible->accessId,
            'role' => $visible->role->value,
            'agency' => ['id' => $visible->organizationId, 'name' => $this->resource['agency_name']],
            'mandant' => ['name' => $visible->mandantName],
            'access_until' => $visible->accessUntil?->toDateString(),
            'in_grace' => $visible->inGrace,
            'read_only' => ! $visible->canWrite(),
        ];
    }
}
