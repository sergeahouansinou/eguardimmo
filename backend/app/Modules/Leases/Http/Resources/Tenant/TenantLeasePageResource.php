<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\TenantLeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Lease> $resource
 */
final class TenantLeasePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Lease>  $page
     * @param  list<TenantLeaseView>  $vues  dans l'ordre de la page
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
        return array_map(fn (TenantLeaseView $vue): array => (new TenantLeaseSummaryResource($vue))->toArray($request), $this->vues);
    }
}
