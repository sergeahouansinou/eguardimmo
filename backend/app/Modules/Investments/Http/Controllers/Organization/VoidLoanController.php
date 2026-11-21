<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\VoidLoan;
use App\Modules\Investments\Http\Requests\VoidLoanRequest;
use App\Modules\Investments\Http\Resources\LoanResource;
use App\Modules\Investments\Http\Support\LoanViews;

final class VoidLoanController
{
    public function __invoke(string $loan, VoidLoanRequest $requete, VoidLoan $annuler, LoanViews $vues): LoanResource
    {
        return $vues->one($annuler->handle($loan, (string) $requete->validated('reason'), (int) $requete->validated('lock_version')));
    }
}
