<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\AddLoanAttestation;
use App\Modules\Investments\Http\Requests\StoreAttestationRequest;
use App\Modules\Investments\Http\Support\Shapes;
use Illuminate\Http\JsonResponse;

final class StoreLoanAttestationController
{
    public function __invoke(string $loan, StoreAttestationRequest $requete, AddLoanAttestation $ajouter): JsonResponse
    {
        $v = $requete->validated();
        $a = $ajouter->handle($loan, (int) $v['income_year'], (int) $v['interest'], (int) ($v['insurance'] ?? 0), (int) ($v['fees'] ?? 0), $requete->upload());

        return response()->json(['data' => ['id' => $a->id, 'loan_id' => $a->loan_id, 'income_year' => $a->income_year, 'interest' => Shapes::money($a->interest), 'insurance' => Shapes::money($a->insurance), 'fees' => Shapes::money($a->fees), 'stored_file_id' => $a->stored_file_id]], 201);
    }
}
