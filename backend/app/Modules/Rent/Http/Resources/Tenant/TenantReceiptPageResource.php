<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources\Tenant;

use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, RentReceipt> $resource
 */
final class TenantReceiptPageResource extends ResourceCollection
{
    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (RentReceipt $q): array => (new TenantReceiptResource($q))->toArray($request))->all());
    }
}
