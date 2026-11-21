<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\PrepayLoan;
use App\Modules\Investments\Http\Requests\PrepaymentRequest;
use App\Modules\Investments\Http\Resources\LoanResource;
use App\Modules\Investments\Http\Support\LoanViews;

final class PrepayLoanController
{
    public function __invoke(string $loan, PrepaymentRequest $requete, PrepayLoan $rembourser, LoanViews $vues): LoanResource
    {
        return $vues->one($rembourser->handle($loan, $requete->toData()));
    }
}
