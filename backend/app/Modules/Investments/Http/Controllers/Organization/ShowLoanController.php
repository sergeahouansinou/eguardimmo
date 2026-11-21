<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Http\Resources\LoanResource;
use App\Modules\Investments\Http\Support\LoanViews;
use App\Modules\Investments\Queries\Loans;

final class ShowLoanController
{
    public function __invoke(string $loan, Loans $prets, LoanViews $vues): LoanResource
    {
        return $vues->one($prets->get($loan));
    }
}
