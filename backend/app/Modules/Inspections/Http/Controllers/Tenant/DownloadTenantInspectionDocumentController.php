<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Queries\TenantInspections;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantInspectionDocumentController
{
    public function __invoke(string $inspection, Request $request, TenantInspections $etats, DocumentStore $fichiers, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $trouve = $etats->find($user->id, $inspection, CarbonImmutable::today()) ?? throw ErrorCode::InspectionNotFound->problem();

        return $contexte->run($trouve['position']->organizationId, fn (): StreamedResponse => DB::transaction(fn (): StreamedResponse => $fichiers->stream($trouve['inspection']->stored_file_id)));
    }
}
