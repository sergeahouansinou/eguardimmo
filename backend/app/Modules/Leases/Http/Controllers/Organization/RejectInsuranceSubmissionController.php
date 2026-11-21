<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\RejectLeaseInsurance;
use App\Modules\Leases\Http\Requests\RejectInsuranceRequest;
use App\Modules\Leases\Http\Resources\InsuranceSubmissionResource;
use App\Modules\Leases\Queries\InsuranceSubmissions;

final class RejectInsuranceSubmissionController
{
    public function __invoke(string $submission, RejectInsuranceRequest $request, InsuranceSubmissions $depots, RejectLeaseInsurance $action): InsuranceSubmissionResource
    {
        /** @var User $user */
        $user = $request->user();

        return new InsuranceSubmissionResource($action->handle($depots->get($submission), $user, $request->reason(), $request->note()));
    }
}
