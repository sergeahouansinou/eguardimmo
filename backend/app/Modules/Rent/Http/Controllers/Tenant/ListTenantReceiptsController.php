<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Requests\ListReceiptsRequest;
use App\Modules\Rent\Http\Resources\Tenant\TenantReceiptPageResource;
use App\Modules\Rent\Queries\TenantReceipts;
use Carbon\CarbonImmutable;

final class ListTenantReceiptsController
{
    public function __invoke(ListReceiptsRequest $request, LeaseDirectory $baux, TenantReceipts $quittances): TenantReceiptPageResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TenantReceiptPageResource($quittances->page($baux->visibleToTenant($user->id, CarbonImmutable::today()), $request->leaseId(), $request->cursor(), $request->perPage()));
    }
}
