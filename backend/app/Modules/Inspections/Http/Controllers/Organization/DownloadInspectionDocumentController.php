<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Inspections\Queries\Inspections;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadInspectionDocumentController
{
    public function __invoke(string $inspection, Inspections $etats, DocumentStore $fichiers): StreamedResponse
    {
        $fichierId = $etats->get($inspection)->stored_file_id;

        return DB::transaction(fn (): StreamedResponse => $fichiers->stream($fichierId));
    }
}
