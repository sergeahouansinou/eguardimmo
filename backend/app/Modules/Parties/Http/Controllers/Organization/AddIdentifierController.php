<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\AddIdentifier;
use App\Modules\Parties\Http\Requests\AddIdentifierRequest;
use App\Modules\Parties\Http\Resources\IdentifierResource;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;

final class AddIdentifierController
{
    public function __invoke(string $party, AddIdentifierRequest $request, Parties $parties, AddIdentifier $ajouter): JsonResponse
    {
        $identifiant = $ajouter->handle($parties->get($party), $request->scheme(), $request->country(), $request->value());

        return (new IdentifierResource($identifiant))->response()->setStatusCode(201);
    }
}
