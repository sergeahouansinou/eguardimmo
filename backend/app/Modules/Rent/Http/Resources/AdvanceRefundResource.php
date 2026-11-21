<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Support\RefundedAdvance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property RefundedAdvance $resource
 */
final class AdvanceRefundResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $premiere = $this->resource->refunds[0];

        return [
            'id' => $premiere->id,
            'lease_id' => $premiere->lease_id,
            'amount' => ApiShapes::money($this->resource->total),
            'refunded_on' => $premiere->refunded_on->toDateString(),
            'source' => $premiere->source,
            'slices' => count($this->resource->refunds),
            'replayed' => $this->resource->replayed,
        ];
    }
}
