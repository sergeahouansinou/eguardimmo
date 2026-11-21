<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Resources;

use App\Modules\Payments\Data\PaymentOptionsData;
use App\Modules\Payments\Http\Support\ApiShapes;
use App\Modules\Rent\Data\PayableInstallmentData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PaymentOptionsData
 */
final class TenantPaymentOptionsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'available' => $this->available(),
            'unavailable_reason' => $this->unavailableReason,
            'methods' => $this->methods,
            'installments' => array_map(fn (PayableInstallmentData $e): array => [
                'id' => $e->installmentId,
                'due_date' => $e->dueDate,
                'remaining' => ApiShapes::money($e->outstanding),
            ], $this->installments),
            'total' => $this->total === null ? null : ApiShapes::money($this->total),
        ];
    }
}
