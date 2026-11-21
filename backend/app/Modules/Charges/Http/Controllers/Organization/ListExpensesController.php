<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Requests\ListExpensesRequest;
use App\Modules\Charges\Http\Resources\ExpensePageResource;
use App\Modules\Charges\Queries\Expenses;

final class ListExpensesController
{
    public function __invoke(ListExpensesRequest $request, Expenses $depenses): ExpensePageResource
    {
        return new ExpensePageResource($depenses->page($request->filters(), $request->cursor(), $request->perPage()));
    }
}
