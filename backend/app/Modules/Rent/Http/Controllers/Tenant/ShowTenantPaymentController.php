<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Http\Resources\Tenant\TenantPaymentResource;
use App\Modules\Rent\Queries\TenantPayments;
use App\Modules\Rent\Queries\TenantRentViews;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantPaymentController
{
    public function __invoke(string $payment, Request $request, LeaseDirectory $baux, TenantPayments $paiements, TenantRentViews $vues): TenantPaymentResource
    {
        /** @var User $user */
        $user = $request->user();
        $paiement = $paiements->get($baux->visibleToTenant($user->id, CarbonImmutable::today()), $payment);

        return new TenantPaymentResource($paiement, $vues->payments([$paiement]));
    }
}
