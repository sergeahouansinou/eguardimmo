<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Support\OwnerUnitView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, array{organization_id: string, unit_id: string}> $resource
 */
final class OwnerPropertyPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, array{organization_id: string, unit_id: string}>  $page
     * @param  list<OwnerUnitView>  $vues  dans l'ordre de la page
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
        return array_map(fn (OwnerUnitView $vue): array => (new OwnerPropertyResource($vue))->toArray($request), $this->vues);
    }
}
