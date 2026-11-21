<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Owner;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Support\OwnerLeaseView;
use App\Modules\Properties\Data\UnitData;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le mandant voit d'un bail : le nom, le rôle et les dates des locataires seulement. Jamais de coordonnées, de garant,
 * d'occupant, de note, de champ personnalisé, de motif de congé, de mode de paiement ni de données de juridiction.
 *
 * @property OwnerLeaseView $resource
 */
final class OwnerLeaseSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource->view;
        $bail = $vue->lease;
        $principal = $vue->mainUnit();
        $fin = $this->resource->scope->end($bail);

        return [
            'id' => $bail->id,
            'reference' => $bail->reference,
            'status' => $bail->status->value,
            'phase' => $vue->phase->value,
            'starts_on' => $bail->starts_on->toDateString(),
            'end_date' => $fin === null ? null : ApiShapes::endDate(CarbonImmutable::parse($fin)),
            'agency' => ['id' => $bail->organization_id, 'name' => $this->resource->agencyName],
            'mandant' => ['name' => $this->resource->visible?->mandantName],
            'main_unit' => $principal === null || ! isset($vue->unitData[$principal->unit_id]) ? null : self::unit($vue->unitData[$principal->unit_id]),
            'tenants' => $this->tenants(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function unit(UnitData $lot): array
    {
        return [
            'id' => $lot->id,
            'reference' => $lot->reference,
            'type' => $lot->unitTypeKey,
            'floor' => $lot->floor,
            'surface_hundredths' => $lot->surfaceHundredths,
            'property' => ['name' => $lot->propertyName, 'address' => $lot->address],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function tenants(): array
    {
        $vue = $this->resource->view;

        $lignes = [];

        foreach ($vue->tenants() as $ligne) {
            $partie = $vue->partyData[$ligne->party_id] ?? null;

            if ($partie === null) {
                continue;
            }

            $lignes[] = [
                'display_name' => $partie->isAnonymized ? 'Locataire anonymisé' : $partie->displayName,
                'role' => $ligne->role->value,
                'valid_from' => $ligne->valid_from->toDateString(),
                'end_date' => ApiShapes::endDate($ligne->valid_to),
            ];
        }

        return $lignes;
    }
}
