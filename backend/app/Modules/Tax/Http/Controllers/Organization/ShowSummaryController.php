<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Queries\Summaries;

final class ShowSummaryController
{
    public function __invoke(string $summary, Summaries $syntheses): SummaryResource
    {
        return new SummaryResource($syntheses->find($summary, SummaryScope::Organization), true);
    }
}
