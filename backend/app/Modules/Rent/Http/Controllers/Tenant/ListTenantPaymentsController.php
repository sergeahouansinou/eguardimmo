<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Requests\ListPaymentsRequest;
use App\Modules\Rent\Http\Resources\Tenant\TenantPaymentPageResource;
use App\Modules\Rent\Queries\TenantPayments;
use App\Modules\Rent\Queries\TenantRentViews;
use Carbon\CarbonImmutable;

final class ListTenantPaymentsController
{
    public function __invoke(ListPaymentsRequest $request, LeaseDirectory $baux, TenantPayments $paiements, TenantRentViews $vues): TenantPaymentPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $page = $paiements->page($baux->visibleToTenant($user->id, CarbonImmutable::today()), $request->leaseId(), $request->status(), $request->cursor(), $request->perPage());

        return new TenantPaymentPageResource($page, $vues->payments(array_values($page->items())));
    }
}
