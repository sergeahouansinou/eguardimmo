<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\UpdateParty;
use App\Modules\Parties\Http\Requests\UpdatePartyRequest;
use App\Modules\Parties\Http\Resources\PartyResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyDetails;

final class UpdatePartyController
{
    public function __invoke(string $party, UpdatePartyRequest $request, Parties $parties, UpdateParty $modifier, PartyDetails $details): PartyResource
    {
        return new PartyResource($details->of($modifier->handle($parties->get($party), $request->toData())));
    }
}
