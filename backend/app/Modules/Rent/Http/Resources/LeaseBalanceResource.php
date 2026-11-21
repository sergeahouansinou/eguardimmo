<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Data\LeaseRentBalanceData;
use App\Modules\Rent\Http\Support\ApiShapes;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseRentBalanceData $resource
 */
final class LeaseBalanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $b = $this->resource;

        return [
            'lease_id' => $b->leaseId,
            'balance' => ApiShapes::money($b->balance),
            'overdue' => ApiShapes::money($b->overdue),
            'advance' => ApiShapes::money($b->advance),
            'unpaid_count' => $b->unpaidCount,
            'oldest_unpaid_due_date' => $b->oldestUnpaidDueDate,
        ];
    }
}
