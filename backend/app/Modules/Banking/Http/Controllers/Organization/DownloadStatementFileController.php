<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadStatementFileController
{
    public function __invoke(Request $request, string $statement, DocumentStore $documents, RecordAudit $audit): StreamedResponse
    {
        $releve = BankStatement::query()->find($statement) ?? throw ErrorCode::StatementNotFound->problem();

        if ($releve->stored_file_id === null) {
            throw ErrorCode::StatementNotFound->problem();
        }

        $audit->handle('banking.statement.downloaded', subject: $releve, metadata: ['source' => $releve->source->value]);

        return $documents->stream($releve->stored_file_id);
    }
}
