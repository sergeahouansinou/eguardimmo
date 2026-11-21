<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\ApproveExpense;
use App\Modules\Charges\Http\Resources\ExpenseResource;
use App\Modules\Charges\Queries\Expenses;

final class ApproveExpenseController
{
    public function __invoke(string $expense, ApproveExpense $valider, Expenses $depenses): ExpenseResource
    {
        $depense = $valider->handle($expense);

        return new ExpenseResource($depense, $depenses->files($depense));
    }
}
