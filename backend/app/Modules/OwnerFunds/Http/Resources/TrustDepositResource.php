<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\TrustDepositRequest;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TrustDepositRequest $resource
 */
final class TrustDepositResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;

        return [
            'id' => $d->id,
            'status' => $d->status->value,
            'amount' => MoneyShape::of($d->amount),
            'executed_on' => $d->executed_on->toDateString(),
            'bank_reference' => $d->bank_reference,
            'second_approver_required' => $d->second_approver_required,
            'requested_by_user_id' => $d->requested_by_user_id,
            'confirmed_by_user_id' => $d->confirmed_by_user_id,
            'confirmed_at' => $d->confirmed_at?->toIso8601String(),
            'confirmed_solo' => $d->confirmed_solo,
            'trust_transfer_id' => $d->trust_transfer_id,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }
}
