<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\PayoutBatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PayoutBatch $resource
 */
final class PayoutBatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $l = $this->resource;
        $donnees = [
            'id' => $l->id,
            'number' => $l->number,
            'status' => $l->status->value,
            'currency' => $l->currency,
            'lock_version' => $l->lock_version,
            'second_approver_required' => $l->second_approver_required,
            'validated_at' => $l->validated_at?->toIso8601String(),
            'cancelled_at' => $l->cancelled_at?->toIso8601String(),
            'cancel_reason' => $l->cancel_reason,
            'created_at' => $l->created_at?->toIso8601String(),
        ];

        if ($l->relationLoaded('items')) {
            $donnees['items'] = PayoutItemResource::collection($l->items)->resolve($request);
        }

        return $donnees;
    }
}
