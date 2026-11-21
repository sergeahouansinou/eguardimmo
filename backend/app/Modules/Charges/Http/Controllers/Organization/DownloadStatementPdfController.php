<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Queries\Statements;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Audit\RecordAudit;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadStatementPdfController
{
    public function __invoke(string $statement, Statements $decomptes, DocumentStore $documents, RecordAudit $audit): StreamedResponse
    {
        $d = $decomptes->get($statement);
        $fichier = $d->stored_file_id ?? throw ErrorCode::FileNotFound->problem('Ce décompte n\'a pas encore de PDF.');
        $audit->handle('charges.statement.downloaded', subject: $d, metadata: ['number' => $d->number]);

        return $documents->stream($fichier);
    }
}
