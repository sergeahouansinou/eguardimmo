<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Queries\Summaries;
use App\Modules\Tax\Support\SummaryDownloads;
use Illuminate\Http\Response;

final class ExportMandantStatementLinesController
{
    public function __invoke(string $statement, Summaries $syntheses, SummaryDownloads $telechargements): Response
    {
        return $telechargements->csv($syntheses->find($statement, SummaryScope::Mandant));
    }
}
