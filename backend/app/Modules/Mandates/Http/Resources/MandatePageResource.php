<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Support\MandateView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Mandate> $resource
 */
final class MandatePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Mandate>  $page
     * @param  list<MandateView>  $vues  dans l'ordre de la page
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
        return array_map(fn (MandateView $vue): array => (new MandateSummaryResource($vue))->toArray($request), $this->vues);
    }
}
