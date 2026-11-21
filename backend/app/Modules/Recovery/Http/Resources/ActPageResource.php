<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Models\RecoveryAct;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, RecoveryAct> $resource
 */
final class ActPageResource extends ResourceCollection
{
    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (RecoveryAct $a): array => (new ActResource($a))->toArray($request))->all());
    }
}
