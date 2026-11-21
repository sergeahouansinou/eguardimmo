<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Payments\Http\Requests\PaymentOptionsRequest;
use App\Modules\Payments\Http\Resources\TenantPaymentOptionsResource;
use App\Modules\Payments\Queries\TenantPaymentOptions;
use Carbon\CarbonImmutable;

final class ShowTenantPaymentOptionsController
{
    public function __invoke(PaymentOptionsRequest $request, LeaseDirectory $baux, TenantPaymentOptions $options): TenantPaymentOptionsResource
    {
        /** @var User $user */
        $user = $request->user();
        $position = $baux->tenantStanding($user->id, (string) $request->validated('lease'), CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();

        return new TenantPaymentOptionsResource($options->of($position));
    }
}
