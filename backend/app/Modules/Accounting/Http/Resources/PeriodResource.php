<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Resources;

use App\Modules\Accounting\Data\AccountingPeriodData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property AccountingPeriodData $resource
 */
final class PeriodResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'month' => $this->resource->start->format('Y-m'),
            'period_start' => $this->resource->start->toDateString(),
            'period_end_exclusive' => $this->resource->end->toDateString(),
            'closed_at' => $this->resource->closedAt->toIso8601String(),
            'closed_by_user_id' => $this->resource->closedByUserId,
            'closing_cutoff' => $this->resource->cutoff,
        ];
    }
}
