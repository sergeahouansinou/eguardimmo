<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\AddLeaseParty;
use App\Modules\Leases\Http\Requests\AddLeasePartyRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\JsonResponse;

final class AddLeasePartyController
{
    public function __invoke(string $lease, AddLeasePartyRequest $request, Leases $baux, AddLeaseParty $ajouter, LeaseDetails $details): JsonResponse
    {
        $ajouter->handle($baux->get($lease), $request->toData());

        return (new LeaseResource($details->get($lease)))->response()->setStatusCode(201);
    }
}
