<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Owner;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\OwnerLeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Lease> $resource
 */
final class OwnerLeasePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Lease>  $page
     * @param  list<OwnerLeaseView>  $vues  dans l'ordre de la page
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
        return array_map(fn (OwnerLeaseView $vue): array => (new OwnerLeaseSummaryResource($vue))->toArray($request), $this->vues);
    }
}
