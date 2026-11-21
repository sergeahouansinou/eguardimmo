<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Queries\Summaries;
use App\Modules\Tax\Support\SummaryDownloads;
use Illuminate\Http\Response;

final class ExportSummaryLinesController
{
    public function __invoke(string $summary, Summaries $syntheses, SummaryDownloads $telechargements): Response
    {
        return $telechargements->csv($syntheses->find($summary, SummaryScope::Organization));
    }
}
