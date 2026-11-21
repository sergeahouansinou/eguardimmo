<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Resources;

use App\Modules\Payments\Http\Support\ApiShapes;
use App\Modules\Payments\Models\OnlinePayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OnlinePayment
 */
final class TenantOnlinePaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lease_id' => $this->lease_id,
            'status' => $this->status->value,
            'method' => $this->method->value,
            'amount' => ApiShapes::money($this->amount),
            'installment_ids' => $this->installment_ids,
            'redirect_url' => $this->status->isLive() ? $this->checkout_url : null,
            'failure_code' => $this->failure_code,
            'created_at' => $this->created_at->toIso8601String(),
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
        ];
    }
}
