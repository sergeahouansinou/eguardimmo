<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Support\OwnerDocumentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, MandateDocument> $resource
 */
final class OwnerDocumentPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, MandateDocument>  $page
     * @param  list<OwnerDocumentView>  $vues  dans l'ordre de la page
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
        return array_map(fn (OwnerDocumentView $vue): array => (new OwnerDocumentResource($vue))->toArray($request), $this->vues);
    }
}
