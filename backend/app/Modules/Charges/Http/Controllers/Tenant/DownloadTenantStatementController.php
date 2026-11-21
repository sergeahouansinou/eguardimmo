<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Tenant;

use App\Modules\Charges\Queries\TenantStatements;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantStatementController
{
    public function __invoke(string $statement, Request $request, LeaseDirectory $baux, TenantStatements $decomptes, DocumentStore $documents, RecordAudit $audit, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $d = $decomptes->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $statement);

        return $contexte->run($d->organization_id, function () use ($d, $documents, $audit): StreamedResponse {
            $audit->handle('charges.statement.downloaded', subject: $d, metadata: ['number' => $d->number, 'by' => 'tenant']);

            return $documents->stream((string) $d->stored_file_id);
        });
    }
}
