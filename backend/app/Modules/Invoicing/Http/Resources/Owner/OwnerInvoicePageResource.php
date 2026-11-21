<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Resources\Owner;

use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Invoice> $resource
 */
final class OwnerInvoicePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Invoice>  $page
     * @param  array<string, string|null>  $agences  nom de l'agence par organisation
     */
    public function __construct(CursorPaginator $page, private readonly array $agences)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(
            fn (Invoice $f): array => (new OwnerInvoiceResource(['invoice' => $f, 'agency_name' => $this->agences[$f->organization_id] ?? null, 'detail' => false]))->toArray($request),
            array_values($this->resource->items()),
        );
    }
}
