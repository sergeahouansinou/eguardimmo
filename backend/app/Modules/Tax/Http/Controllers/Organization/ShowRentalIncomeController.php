<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Actions\ComputeRentalIncome;
use App\Modules\Tax\Http\Requests\ShowRentalIncomeRequest;
use App\Modules\Tax\Http\Resources\RentalIncomeResource;

final class ShowRentalIncomeController
{
    public function __invoke(int $year, ShowRentalIncomeRequest $requete, ComputeRentalIncome $calcul): RentalIncomeResource
    {
        return new RentalIncomeResource($calcul->handle($year, $requete->householdComplete())->income);
    }
}
