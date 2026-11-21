<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Requests\ListCursorRequest;
use App\Modules\Leases\Http\Resources\Tenant\TenantLeaseDocumentPageResource;
use App\Modules\Leases\Queries\TenantLeaseDocuments;
use App\Modules\Leases\Queries\TenantLeaseDocumentViews;
use App\Modules\Leases\Queries\TenantStandings;
use Carbon\CarbonImmutable;

final class ListTenantLeaseDocumentsController
{
    public function __invoke(string $lease, ListCursorRequest $request, TenantStandings $positions, TenantLeaseDocuments $documents, TenantLeaseDocumentViews $vues): TenantLeaseDocumentPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $position = $positions->find($user->id, $lease, CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();
        $page = $documents->page($position, $request->perPage(), $request->cursor());

        return new TenantLeaseDocumentPageResource($page, $vues->of($position, $page->items(), $request->cursor() === null));
    }
}
