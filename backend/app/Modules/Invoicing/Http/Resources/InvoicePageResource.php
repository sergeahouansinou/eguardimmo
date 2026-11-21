<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Resources;

use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;
use Money\Money;

/**
 * @property CursorPaginator<int, Invoice> $resource
 */
final class InvoicePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Invoice>  $page
     * @param  array<string, Money>  $restes
     */
    public function __construct(CursorPaginator $page, private readonly array $restes)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Invoice $f): array => (new InvoiceResource($f, $this->restes[$f->id] ?? null))->toArray($request))->all());
    }
}
