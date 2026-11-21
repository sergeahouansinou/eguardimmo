<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Inspections\Queries\Inspections;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadInspectionRemarkFileController
{
    public function __invoke(string $file, Inspections $etats, DocumentStore $fichiers): StreamedResponse
    {
        $fichierId = $etats->file($file)->stored_file_id;

        return DB::transaction(fn (): StreamedResponse => $fichiers->stream($fichierId));
    }
}
