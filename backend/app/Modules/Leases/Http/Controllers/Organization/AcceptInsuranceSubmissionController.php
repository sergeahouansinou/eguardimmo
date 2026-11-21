<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\AcceptLeaseInsurance;
use App\Modules\Leases\Http\Resources\InsuranceSubmissionResource;
use App\Modules\Leases\Queries\InsuranceSubmissions;
use Illuminate\Http\Request;

final class AcceptInsuranceSubmissionController
{
    public function __invoke(string $submission, Request $request, InsuranceSubmissions $depots, AcceptLeaseInsurance $action): InsuranceSubmissionResource
    {
        /** @var User $user */
        $user = $request->user();

        return new InsuranceSubmissionResource($action->handle($depots->get($submission), $user));
    }
}
