<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Tenant;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Queries\TenantStatements;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantStatementFileController
{
    public function __invoke(string $statement, string $file, Request $request, LeaseDirectory $baux, TenantStatements $decomptes, DocumentStore $documents, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $d = $decomptes->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $statement);
        $piece = $decomptes->sharedFiles(collect([$d]))->firstWhere('id', $file) ?? throw ErrorCode::FileNotFound->problem();

        return $contexte->run($d->organization_id, fn (): StreamedResponse => $documents->stream($piece->stored_file_id));
    }
}
