<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\AnonymizeParty;
use App\Modules\Parties\Http\Resources\PartyResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyDetails;

final class AnonymizePartyController
{
    public function __invoke(string $party, Parties $parties, AnonymizeParty $anonymiser, PartyDetails $details): PartyResource
    {
        return new PartyResource($details->of($anonymiser->handle($parties->get($party), 'requested')));
    }
}
