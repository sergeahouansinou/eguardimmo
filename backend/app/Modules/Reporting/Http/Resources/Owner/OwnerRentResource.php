<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources\Owner;

use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Properties\Data\UnitData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Loyers d'un mois : un bloc par agence et par mandant, chacun dans sa devise. Aucun total ne traverse deux blocs ; le retard
 * est le seul indicateur de paiement du locataire, jamais son identité ni ses coordonnées.
 *
 * @property array{month: string, mandants: list<array{visible: OwnerVisibleData, agency_name: string|null, currency: string, units: list<array{unit: UnitData, amounts: array<string, int>, arrears: int|null}>, others: array<string, int>, totals: array<string, int>}>} $resource
 */
final class OwnerRentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'month' => $this->resource['month'],
            'mandants' => array_map(fn (array $m): array => [
                'agency' => ['id' => $m['visible']->organizationId, 'name' => $m['agency_name']],
                'mandant' => ['name' => $m['visible']->mandantName, 'role' => $m['visible']->role->value],
                'currency' => $m['currency'],
                'units' => array_map(fn (array $u): array => [
                    'unit' => ['id' => $u['unit']->id, 'reference' => $u['unit']->reference, 'property_name' => $u['unit']->propertyName],
                    'amounts' => $this->amounts($u['amounts'], $m['currency']),
                    'arrears' => $u['arrears'] === null ? null : ['amount' => $u['arrears'], 'currency' => $m['currency']],
                ], $m['units']),
                'others' => $this->amounts($m['others'], $m['currency']),
                'totals' => $this->amounts($m['totals'], $m['currency']),
            ], $this->resource['mandants']),
        ];
    }

    /**
     * @param  array<string, int>  $montants
     * @return array<string, array{amount: int, currency: string}>
     */
    private function amounts(array $montants, string $devise): array
    {
        return array_map(fn (int $valeur): array => ['amount' => $valeur, 'currency' => $devise], $montants);
    }
}
