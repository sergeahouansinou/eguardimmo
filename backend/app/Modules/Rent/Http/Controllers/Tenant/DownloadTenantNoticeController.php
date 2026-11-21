<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Queries\TenantInstallments;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantNoticeController
{
    public function __invoke(string $installment, Request $request, LeaseDirectory $baux, TenantInstallments $echeances, DocumentStore $documents, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $avis = $echeances->notice($baux->visibleToTenant($user->id, CarbonImmutable::today()), $installment);

        return $contexte->run($avis->organization_id, fn (): StreamedResponse => $documents->stream($avis->stored_file_id));
    }
}
