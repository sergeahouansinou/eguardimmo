<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerDocuments;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerDocumentController
{
    public function __invoke(string $document, Request $request, MandateDirectory $repertoire, OwnerDocuments $documents, DocumentStore $fichiers, CurrentOrganization $contexte, RecordAudit $audit): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $piece = $documents->find($repertoire->ownerScope($user->id), $document) ?? throw ErrorCode::OwnerDocumentNotFound->problem();

        return $contexte->run($piece->organization_id, function () use ($piece, $fichiers, $audit): StreamedResponse {
            return DB::transaction(function () use ($piece, $fichiers, $audit): StreamedResponse {
                $reponse = $fichiers->stream($piece->stored_file_id);
                $audit->handle('mandates.document.downloaded', subject: $piece, metadata: ['kind' => $piece->kind->value]);

                return $reponse;
            });
        });
    }
}
