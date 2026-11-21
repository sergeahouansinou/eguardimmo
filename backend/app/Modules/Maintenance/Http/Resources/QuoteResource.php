<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\InterventionQuote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InterventionQuote $resource
 */
final class QuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $q = $this->resource;

        return [
            'id' => $q->id,
            'intervention_id' => $q->intervention_id,
            'supplier_party_id' => $q->supplier_party_id,
            'reference' => $q->reference,
            'kind' => $q->kind->value,
            'status' => $q->status->value,
            'issued_on' => $q->issued_on->toDateString(),
            'valid_until' => $q->valid_until?->toDateString(),
            'proposed_on' => $q->proposed_on?->toDateString(),
            'message' => $q->message,
            'total_net' => Shapes::money($q->total_net),
            'total_tax' => Shapes::money($q->total_tax),
            'total_gross' => Shapes::money($q->total_gross),
            'lines' => $q->relationLoaded('lines') ? $q->lines->map(fn ($l): array => [
                'position' => $l->position,
                'label' => $l->label,
                'quantity_milli' => $l->quantity_milli,
                'unit' => $l->unit,
                'unit_price' => $l->unit_price,
                'net_amount' => $l->net_amount,
                'tax_category' => $l->tax_category->value,
                'tax_rate_pcm' => $l->tax_rate_pcm,
            ])->values()->all() : null,
            'lock_version' => $q->lock_version,
        ];
    }
}
