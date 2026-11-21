<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property BankMatch $resource
 */
final class BankMatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'bank_account_id' => $r->bank_account_id,
            'kind' => $r->kind->value,
            'rule' => $r->rule?->value,
            'confidence' => $r->confidence?->value,
            'explanation' => $r->explanation,
            'matched_by_user_id' => $r->matched_by_user_id,
            'undone_at' => $r->undone_at?->toIso8601String(),
            'undo_reason' => $r->undo_reason,
            'created_at' => $r->created_at?->toIso8601String(),
            'items' => $r->items->map(static fn (BankMatchItem $i): array => [
                'side' => $i->side->value, 'ref_id' => $i->ref_id, 'amount' => MoneyShape::of($i->amount),
            ])->values()->all(),
        ];
    }
}
