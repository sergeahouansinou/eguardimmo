<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\UpdateContactPoint;
use App\Modules\Parties\Http\Requests\UpdateContactPointRequest;
use App\Modules\Parties\Http\Resources\ContactPointResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyParts;

final class UpdateContactPointController
{
    public function __invoke(string $party, string $contactPoint, UpdateContactPointRequest $request, Parties $parties, PartyParts $parts, UpdateContactPoint $modifier): ContactPointResource
    {
        $point = $parts->contactPoint($parties->get($party)->id, $contactPoint);

        return new ContactPointResource($modifier->handle($point, $request->fields(), $request->promote()));
    }
}
