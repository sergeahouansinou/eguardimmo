<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Requests\ListTenantInstallmentsRequest;
use App\Modules\Rent\Http\Resources\Tenant\TenantInstallmentPageResource;
use App\Modules\Rent\Queries\TenantInstallments;
use App\Modules\Rent\Queries\TenantRentViews;
use Carbon\CarbonImmutable;

final class ListTenantInstallmentsController
{
    public function __invoke(ListTenantInstallmentsRequest $request, LeaseDirectory $baux, TenantInstallments $echeances, TenantRentViews $vues): TenantInstallmentPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $page = $echeances->page($baux->visibleToTenant($user->id, $today), $request->leaseId(), $request->status(), $request->cursor(), $request->perPage());

        return new TenantInstallmentPageResource($page, $vues->installments(array_values($page->items()), $today, false));
    }
}
