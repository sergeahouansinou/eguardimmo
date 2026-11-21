<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Queries\TenantLeaseDocuments;
use App\Modules\Leases\Queries\TenantLeaseDocumentViews;
use App\Modules\Leases\Queries\TenantStandings;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantLeaseDocumentController
{
    public function __invoke(string $lease, string $document, Request $request, TenantStandings $positions, TenantLeaseDocuments $documents, TenantLeaseDocumentViews $vues, DocumentStore $fichiers, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $position = $positions->find($user->id, $lease, CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();
        $signe = $vues->signedFileId($position);
        $fichierId = $signe === $document ? $signe : ($documents->find($position, $document)->stored_file_id ?? throw ErrorCode::LeaseDocumentNotFound->problem());

        return $contexte->run($position->organizationId, fn (): StreamedResponse => DB::transaction(fn (): StreamedResponse => $fichiers->streamGeneric($fichierId)));
    }
}
