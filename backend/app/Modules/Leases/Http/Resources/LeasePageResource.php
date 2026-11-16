<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\LeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Lease> $resource
 */
final class LeasePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Lease>  $page
     * @param  list<LeaseView>  $vues  dans l'ordre de la page
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
        return array_map(fn (LeaseView $vue): array => (new LeaseSummaryResource($vue))->toArray($request), $this->vues);
    }
}
