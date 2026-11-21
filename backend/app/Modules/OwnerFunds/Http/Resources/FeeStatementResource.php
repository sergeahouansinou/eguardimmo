<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\FeeStatement;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property FeeStatement $resource
 */
final class FeeStatementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $s = $this->resource;

        return [
            'id' => $s->id,
            'mandate_id' => $s->mandate_id,
            'mandant_party_id' => $s->mandant_party_id,
            'month' => $s->period_start->format('Y-m'),
            'base_rent' => MoneyShape::of($s->base_rent),
            'base_charges' => MoneyShape::of($s->base_charges),
            'fee_kind' => $s->fee_kind,
            'rate_bp' => $s->rate_bp,
            'minimum_applied' => $s->minimum_applied,
            'fee_net' => MoneyShape::of($s->fee_net),
            'tax_amount' => MoneyShape::of($s->tax_amount),
            'fee_total' => MoneyShape::of($s->fee_total),
            'carried_net' => MoneyShape::of($s->carried_net),
            'invoice_id' => $s->invoice_id,
            'credit_note_id' => $s->credit_note_id,
        ];
    }
}
