<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Models\LeaseDocument;
use App\Modules\Leases\Support\LeaseDocumentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, LeaseDocument> $resource
 */
final class TenantLeaseDocumentPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, LeaseDocument>  $page
     * @param  list<LeaseDocumentView>  $vues
     */
    public function __construct(CursorPaginator $page, private readonly array $vues)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(fn (LeaseDocumentView $vue): array => (new TenantLeaseDocumentResource($vue))->toArray($request), $this->vues);
    }
}
