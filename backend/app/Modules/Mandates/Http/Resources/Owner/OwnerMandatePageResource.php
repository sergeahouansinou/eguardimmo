<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Support\OwnerMandateView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Mandate> $resource
 */
final class OwnerMandatePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Mandate>  $page
     * @param  list<OwnerMandateView>  $vues  dans l'ordre de la page
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
        return array_map(fn (OwnerMandateView $vue): array => (new OwnerMandateResource($vue))->toArray($request), $this->vues);
    }
}
