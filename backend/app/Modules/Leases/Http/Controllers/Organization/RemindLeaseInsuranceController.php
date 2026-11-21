<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\RemindLeaseInsurance;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RemindLeaseInsuranceController
{
    public function __invoke(string $lease, Request $request, Leases $baux, RemindLeaseInsurance $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($baux->get($lease), $user);

        return response()->json(['data' => ['status' => 'sent']], 202);
    }
}
