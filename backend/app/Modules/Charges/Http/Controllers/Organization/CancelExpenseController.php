<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\CancelExpense;
use App\Modules\Charges\Http\Requests\ReasonRequest;
use App\Modules\Charges\Http\Resources\ExpenseResource;
use App\Modules\Charges\Queries\Expenses;

final class CancelExpenseController
{
    public function __invoke(string $expense, ReasonRequest $request, CancelExpense $annuler, Expenses $depenses): ExpenseResource
    {
        $depense = $annuler->handle($expense, $request->reason());

        return new ExpenseResource($depense, $depenses->files($depense));
    }
}
