<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Properties\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * Page de lots : les types sont résolus une fois pour toute la page, et le paginateur garde ses modèles pour son curseur.
 *
 * @property CursorPaginator<int, Unit> $resource
 */
final class UnitPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Unit>  $page
     * @param  array<string, TermData>  $types
     */
    public function __construct(CursorPaginator $page, private readonly array $types)
    {
        parent::__construct($page);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(
            fn (Unit $lot): array => (new UnitSummaryResource($lot, $this->types[$lot->unit_type_term_id]))->toArray($request),
            array_values($this->resource->items()),
        );
    }
}
