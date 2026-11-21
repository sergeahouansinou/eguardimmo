<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\RecordExpense;
use App\Modules\Charges\Http\Requests\StoreExpenseRequest;
use App\Modules\Charges\Http\Resources\ExpenseResource;
use App\Modules\Charges\Http\Support\IdempotencyHeader;
use App\Modules\Charges\Queries\Expenses;
use Illuminate\Http\JsonResponse;

final class StoreExpenseController
{
    public function __invoke(StoreExpenseRequest $request, RecordExpense $enregistrer, Expenses $depenses): JsonResponse
    {
        $resultat = $enregistrer->handle($request->toData(IdempotencyHeader::read($request)));

        return (new ExpenseResource($resultat['expense'], $depenses->files($resultat['expense'])))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
