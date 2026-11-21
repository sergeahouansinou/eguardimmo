<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\WithdrawLeaseInsurance;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantInsuranceSubmissionResource;
use App\Modules\Leases\Queries\TenantInsuranceSubmissions;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class WithdrawTenantInsuranceController
{
    public function __invoke(string $submission, Request $request, TenantInsuranceSubmissions $depots, WithdrawLeaseInsurance $action): TenantInsuranceSubmissionResource
    {
        /** @var User $user */
        $user = $request->user();
        $depot = $depots->find($user->id, $submission, CarbonImmutable::today()) ?? throw ErrorCode::InsuranceSubmissionNotFound->problem();

        return new TenantInsuranceSubmissionResource($action->handle($depot->organization_id, $depot->id, $user));
    }
}
