<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Models\ChargeExercise;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, ChargeExercise> $resource
 */
final class ExercisePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, ChargeExercise>  $page
     */
    public function __construct(CursorPaginator $page)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (ChargeExercise $e): array => (new ExerciseResource($e))->toArray($request))->all());
    }
}
