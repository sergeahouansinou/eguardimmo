<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Data\Lookups;
use App\Modules\Maintenance\Models\Intervention;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Intervention> $resource
 */
final class InterventionPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Intervention>  $page
     */
    public function __construct(CursorPaginator $page, private readonly Lookups $noms)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Intervention $i): array => (new InterventionResource($i, $this->noms))->toArray($request))->all());
    }
}
