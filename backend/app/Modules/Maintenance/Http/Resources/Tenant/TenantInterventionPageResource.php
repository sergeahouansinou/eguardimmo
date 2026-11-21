<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Tenant;

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\TenantView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Intervention> $resource
 */
final class TenantInterventionPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Intervention>  $page
     * @param  array<string, TenantView>  $vues
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
        return array_values($this->resource->getCollection()->map(fn (Intervention $i): array => (new TenantInterventionResource($i, $this->vues[$i->id]))->toArray($request))->all());
    }
}
