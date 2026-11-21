<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Queries\Summaries;
use App\Modules\Tax\Support\SummaryDownloads;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadMandantStatementPdfController
{
    public function __invoke(string $statement, Summaries $syntheses, SummaryDownloads $telechargements): StreamedResponse
    {
        return $telechargements->pdf($syntheses->find($statement, SummaryScope::Mandant));
    }
}
