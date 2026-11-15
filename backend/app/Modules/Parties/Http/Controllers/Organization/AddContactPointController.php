<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\AddContactPoint;
use App\Modules\Parties\Http\Requests\AddContactPointRequest;
use App\Modules\Parties\Http\Resources\ContactPointResource;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;

final class AddContactPointController
{
    public function __invoke(string $party, AddContactPointRequest $request, Parties $parties, AddContactPoint $ajouter): JsonResponse
    {
        $point = $ajouter->handle($parties->get($party), $request->type(), $request->value(), $request->label(), $request->primary());

        return (new ContactPointResource($point))->response()->setStatusCode(201);
    }
}
