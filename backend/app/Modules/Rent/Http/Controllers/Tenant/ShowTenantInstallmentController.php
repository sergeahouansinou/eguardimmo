<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Resources\Tenant\TenantInstallmentResource;
use App\Modules\Rent\Queries\TenantInstallments;
use App\Modules\Rent\Queries\TenantRentViews;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantInstallmentController
{
    public function __invoke(string $installment, Request $request, LeaseDirectory $baux, TenantInstallments $echeances, TenantRentViews $vues): TenantInstallmentResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $echeance = $echeances->get($baux->visibleToTenant($user->id, $today), $installment);

        return new TenantInstallmentResource($echeance, $vues->installments([$echeance], $today, true));
    }
}
