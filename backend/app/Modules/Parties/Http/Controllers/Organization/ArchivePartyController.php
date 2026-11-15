<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\ArchiveParty;
use App\Modules\Parties\Http\Resources\PartyResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyDetails;

final class ArchivePartyController
{
    public function __invoke(string $party, Parties $parties, ArchiveParty $action, PartyDetails $details): PartyResource
    {
        return new PartyResource($details->of($action->handle($parties->get($party))));
    }
}
