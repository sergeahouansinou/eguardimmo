<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources\Tenant;

use App\Modules\Rent\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Payment> $resource
 */
final class TenantPaymentPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Payment>  $page
     * @param  array<string, string>  $references
     */
    public function __construct(CursorPaginator $page, private readonly array $references)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Payment $p): array => (new TenantPaymentResource($p, $this->references))->toArray($request))->all());
    }
}
