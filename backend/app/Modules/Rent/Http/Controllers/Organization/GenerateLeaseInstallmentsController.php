<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Actions\GenerateInstallments;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class GenerateLeaseInstallmentsController
{
    public function __invoke(string $lease, LeaseSchedule $baux, GenerateInstallments $generer): JsonResponse
    {
        return response()->json(['data' => $generer->handle($baux->billing($lease), CarbonImmutable::today())]);
    }
}
