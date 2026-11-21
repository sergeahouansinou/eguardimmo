<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Payment> $resource
 */
final class PaymentPageResource extends ResourceCollection
{
    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Payment $p): array => (new PaymentResource($p))->toArray($request))->all());
    }
}
