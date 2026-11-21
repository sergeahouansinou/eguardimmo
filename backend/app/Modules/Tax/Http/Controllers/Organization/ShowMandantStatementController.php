<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Queries\Summaries;

final class ShowMandantStatementController
{
    public function __invoke(string $statement, Summaries $syntheses): SummaryResource
    {
        return new SummaryResource($syntheses->find($statement, SummaryScope::Mandant), true);
    }
}
