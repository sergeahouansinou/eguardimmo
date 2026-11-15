<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\CreateParty;
use App\Modules\Parties\Http\Requests\CreatePartyRequest;
use App\Modules\Parties\Http\Resources\PartyResource;
use App\Modules\Parties\Queries\PartyDetails;
use Illuminate\Http\JsonResponse;

final class CreatePartyController
{
    public function __invoke(CreatePartyRequest $request, CreateParty $creer, PartyDetails $details): JsonResponse
    {
        return (new PartyResource($details->of($creer->handle($request->toData()))))->response()->setStatusCode(201);
    }
}
