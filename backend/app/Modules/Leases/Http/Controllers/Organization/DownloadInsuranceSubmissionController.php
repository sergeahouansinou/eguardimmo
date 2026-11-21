<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Queries\InsuranceSubmissions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadInsuranceSubmissionController
{
    public function __invoke(string $submission, Request $request, InsuranceSubmissions $depots, DocumentStore $fichiers, RecordAudit $audit): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $depot = $depots->get($submission);

        return DB::transaction(function () use ($fichiers, $depot, $audit, $user): StreamedResponse {
            $reponse = $fichiers->stream($depot->stored_file_id);
            $audit->handle('leases.insurance.downloaded', $user->id, [], $depot);

            return $reponse;
        });
    }
}
