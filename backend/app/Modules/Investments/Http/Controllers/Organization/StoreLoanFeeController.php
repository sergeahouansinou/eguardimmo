<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\AddLoanFee;
use App\Modules\Investments\Enums\FeeKind;
use App\Modules\Investments\Http\Requests\StoreFeeRequest;
use App\Modules\Investments\Http\Support\Shapes;
use Illuminate\Http\JsonResponse;

final class StoreLoanFeeController
{
    public function __invoke(string $loan, StoreFeeRequest $requete, AddLoanFee $ajouter): JsonResponse
    {
        $v = $requete->validated();
        $frais = $ajouter->handle($loan, FeeKind::from((string) $v['kind']), (string) $v['paid_on'], (int) $v['amount'], $requete->file('document'));

        return response()->json(['data' => ['id' => $frais->id, 'loan_id' => $frais->loan_id, 'kind' => $frais->kind, 'paid_on' => $frais->paid_on->toDateString(), 'amount' => Shapes::money($frais->amount), 'stored_file_id' => $frais->stored_file_id]], 201);
    }
}
