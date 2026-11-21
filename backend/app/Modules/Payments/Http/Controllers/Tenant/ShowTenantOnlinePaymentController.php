<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Http\Resources\TenantOnlinePaymentResource;
use App\Modules\Payments\Queries\OnlinePayments;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantOnlinePaymentController
{
    public function __invoke(string $payment, Request $request, OnlinePayments $paiements): TenantOnlinePaymentResource
    {
        /** @var User $user */
        $user = $request->user();
        $trouve = $paiements->findForTenant($user->id, $payment, CarbonImmutable::today()) ?? throw ErrorCode::OnlinePaymentNotFound->problem();

        return new TenantOnlinePaymentResource($trouve['payment']);
    }
}
