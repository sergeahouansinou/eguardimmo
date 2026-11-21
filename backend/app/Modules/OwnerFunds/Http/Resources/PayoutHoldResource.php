<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PayoutHold $resource
 */
final class PayoutHoldResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'mandant_party_id' => $r->mandant_party_id,
            'kind' => $r->kind->value,
            'amount' => $r->amount === null ? null : MoneyShape::of($r->amount),
            'reason' => $r->reason->value,
            'comment' => $r->comment,
            'placed_by_user_id' => $r->placed_by_user_id,
            'released_at' => $r->released_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
