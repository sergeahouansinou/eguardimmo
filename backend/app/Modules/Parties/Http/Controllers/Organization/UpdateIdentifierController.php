<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\UpdateIdentifier;
use App\Modules\Parties\Http\Requests\UpdateIdentifierRequest;
use App\Modules\Parties\Http\Resources\IdentifierResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyParts;

final class UpdateIdentifierController
{
    public function __invoke(string $party, string $identifier, UpdateIdentifierRequest $request, Parties $parties, PartyParts $parts, UpdateIdentifier $modifier): IdentifierResource
    {
        $identifiant = $parts->identifier($parties->get($party)->id, $identifier);

        return new IdentifierResource($modifier->handle($identifiant, $request->country(), $request->value()));
    }
}
