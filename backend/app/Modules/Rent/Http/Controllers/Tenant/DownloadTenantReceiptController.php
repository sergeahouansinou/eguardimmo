<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Queries\TenantReceipts;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantReceiptController
{
    public function __invoke(string $receipt, Request $request, LeaseDirectory $baux, TenantReceipts $quittances, DocumentStore $documents, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $quittance = $quittances->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $receipt);

        if ($quittance->voided_at !== null) {
            throw ErrorCode::ReceiptVoid->problem();
        }

        return $contexte->run($quittance->organization_id, fn (): StreamedResponse => $documents->stream($quittance->stored_file_id));
    }
}
