<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Expense> $resource
 */
final class ExpensePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Expense>  $page
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
        return array_values($this->resource->getCollection()->map(fn (Expense $d): array => (new ExpenseResource($d))->toArray($request))->all());
    }
}
