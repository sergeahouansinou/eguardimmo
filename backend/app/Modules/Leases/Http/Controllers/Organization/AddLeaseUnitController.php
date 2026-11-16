<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\AddLeaseUnit;
use App\Modules\Leases\Http\Requests\AddLeaseUnitRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\JsonResponse;

final class AddLeaseUnitController
{
    public function __invoke(string $lease, AddLeaseUnitRequest $request, Leases $baux, AddLeaseUnit $ajouter, LeaseDetails $details): JsonResponse
    {
        $bail = $ajouter->handle($baux->get($lease), $request->toData());

        return (new LeaseResource($details->get($bail->id)))->response()->setStatusCode(201);
    }
}
