<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Resources\Tenant\TenantReceiptResource;
use App\Modules\Rent\Queries\TenantReceipts;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantReceiptController
{
    public function __invoke(string $receipt, Request $request, LeaseDirectory $baux, TenantReceipts $quittances): TenantReceiptResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TenantReceiptResource($quittances->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $receipt), detail: true);
    }
}
