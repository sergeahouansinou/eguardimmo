<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Http\Resources\PartyResource;
use App\Modules\Parties\Queries\PartyDetails;

final class ShowPartyController
{
    public function __invoke(string $party, PartyDetails $details): PartyResource
    {
        return new PartyResource($details->get($party));
    }
}
