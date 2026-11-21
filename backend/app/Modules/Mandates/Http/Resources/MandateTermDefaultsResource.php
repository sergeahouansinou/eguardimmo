<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Http\Support\ApiShapes;
use App\Modules\Mandates\Models\MandateTermDefault;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property MandateTermDefault $resource
 */
final class MandateTermDefaultsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;

        return [
            'fee_kind' => $d->fee_kind->value,
            'fee_basis_points' => $d->fee_basis_points,
            'fee_flat_amount' => $d->fee_flat_amount === null ? null : ApiShapes::money($d->fee_flat_amount),
            'fee_base' => $d->fee_base->value,
            'fee_minimum_amount' => ApiShapes::money($d->fee_minimum_amount),
            'fee_tax_mode' => $d->fee_tax_mode->value,
            'payout_day' => $d->payout_day,
            'works_limit_amount' => ApiShapes::money($d->works_limit_amount),
            'letting_fee_basis_points' => $d->letting_fee_basis_points,
            'works_fee_basis_points' => $d->works_fee_basis_points,
            'currency' => $d->currency,
            'lock_version' => $d->lock_version,
            'updated_at' => $d->updated_at->toIso8601String(),
        ];
    }
}
