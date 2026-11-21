<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Resources\Tenant;

use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Support\TenantInspectionView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Inspection> $resource
 */
final class TenantInspectionPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Inspection>  $page
     * @param  list<TenantInspectionView>  $vues
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
        return array_map(fn (TenantInspectionView $vue): array => (new TenantInspectionResource($vue))->toArray($request), $this->vues);
    }
}
