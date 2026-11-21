<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Resources\ExpenseResource;
use App\Modules\Charges\Queries\Expenses;

final class ShowExpenseController
{
    public function __invoke(string $expense, Expenses $depenses): ExpenseResource
    {
        $depense = $depenses->get($expense);

        return new ExpenseResource($depense, $depenses->files($depense));
    }
}
