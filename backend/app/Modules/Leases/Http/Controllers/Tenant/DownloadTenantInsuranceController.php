<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Queries\TenantInsuranceSubmissions;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantInsuranceController
{
    public function __invoke(string $submission, Request $request, TenantInsuranceSubmissions $depots, DocumentStore $fichiers, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $depot = $depots->find($user->id, $submission, CarbonImmutable::today()) ?? throw ErrorCode::InsuranceSubmissionNotFound->problem();

        return $contexte->run($depot->organization_id, fn (): StreamedResponse => DB::transaction(fn (): StreamedResponse => $fichiers->stream($depot->stored_file_id)));
    }
}
