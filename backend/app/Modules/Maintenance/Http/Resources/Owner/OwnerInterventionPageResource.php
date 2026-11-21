<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Owner;

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\OwnerView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Intervention> $resource
 */
final class OwnerInterventionPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Intervention>  $page
     * @param  array<string, OwnerView>  $vues
     * @param  array<string, string|null>  $agences  nom de l'agence par organisation
     */
    public function __construct(CursorPaginator $page, private readonly array $vues, private readonly array $agences)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Intervention $i): array => (new OwnerInterventionResource([
            'intervention' => $i, 'view' => $this->vues[$i->id], 'agency_name' => $this->agences[$i->organization_id] ?? null, 'detail' => false,
        ]))->toArray($request))->all());
    }
}
