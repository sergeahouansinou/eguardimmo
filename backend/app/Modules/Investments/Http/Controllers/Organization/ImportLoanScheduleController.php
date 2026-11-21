<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Actions\ImportLoanSchedule;
use App\Modules\Investments\Http\Requests\ImportScheduleRequest;
use App\Modules\Investments\Http\Resources\LoanResource;
use App\Modules\Investments\Http\Support\LoanViews;

final class ImportLoanScheduleController
{
    public function __invoke(string $loan, ImportScheduleRequest $requete, ImportLoanSchedule $importer, LoanViews $vues): LoanResource
    {
        return $vues->one($importer->handle($loan, $requete->upload(), (int) $requete->validated('lock_version')));
    }
}
