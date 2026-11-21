<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Queries\TenantNoticeRequests;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantNoticeLetterController
{
    public function __invoke(string $noticeRequest, Request $request, TenantNoticeRequests $demandes, DocumentStore $fichiers, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $demande = $demandes->find($user->id, $noticeRequest, CarbonImmutable::today()) ?? throw ErrorCode::NoticeRequestNotFound->problem();
        $fichierId = $demande->letter_file_id ?? throw ErrorCode::NoticeRequestNotFound->problem();

        return $contexte->run($demande->organization_id, fn (): StreamedResponse => DB::transaction(fn (): StreamedResponse => $fichiers->stream($fichierId)));
    }
}
