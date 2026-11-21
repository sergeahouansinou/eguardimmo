<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\CreateLoan;
use App\Modules\Investments\Http\Requests\StoreLoanRequest;
use App\Modules\Investments\Http\Support\IdempotencyHeader;
use App\Modules\Investments\Http\Support\LoanViews;
use Illuminate\Http\JsonResponse;

final class StoreLoanController
{
    public function __invoke(StoreLoanRequest $requete, CreateLoan $creer, LoanViews $vues): JsonResponse
    {
        $resultat = $creer->handle($requete->toData(IdempotencyHeader::read($requete)));

        return $vues->one($resultat['loan'])->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
