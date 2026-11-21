<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Queries\NoticeRequests;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadNoticeProofController
{
    public function __invoke(string $noticeRequest, Request $request, NoticeRequests $demandes, DocumentStore $fichiers, RecordAudit $audit): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $demande = $demandes->get($noticeRequest);
        $fichierId = $demande->proof_file_id ?? throw ErrorCode::NoticeRequestNotFound->problem();

        return DB::transaction(function () use ($fichiers, $fichierId, $audit, $user, $demande): StreamedResponse {
            $reponse = $fichiers->stream($fichierId);
            $audit->handle('leases.notice_request.proof_downloaded', $user->id, [], $demande);

            return $reponse;
        });
    }
}
