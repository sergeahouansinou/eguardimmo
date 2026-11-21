<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Support\CaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, RecoveryCase> $resource
 */
final class CasePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, RecoveryCase>  $page
     */
    public function __construct(CursorPaginator $page, private readonly CaseView $vue)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (RecoveryCase $d): array => (new CaseResource($d, $this->vue))->toArray($request))->all());
    }
}
