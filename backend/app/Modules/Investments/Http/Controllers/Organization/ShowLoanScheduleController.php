<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Http\Resources\ScheduleResource;
use App\Modules\Investments\Queries\Loans;
use App\Modules\Investments\Support\ScheduleWriter;

final class ShowLoanScheduleController
{
    public function __invoke(string $loan, Loans $prets, ScheduleWriter $echeanciers): ScheduleResource
    {
        $pret = $prets->get($loan);

        return new ScheduleResource($pret, $echeanciers->latest($pret->id));
    }
}
