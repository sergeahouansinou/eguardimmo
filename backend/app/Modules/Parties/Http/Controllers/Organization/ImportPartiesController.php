<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\ImportParties;
use App\Modules\Parties\Http\Requests\ImportPartiesRequest;
use App\Modules\Parties\Http\Resources\PartyImportResource;
use Illuminate\Http\JsonResponse;

final class ImportPartiesController
{
    public function __invoke(ImportPartiesRequest $request, ImportParties $importer): JsonResponse
    {
        $resultat = $importer->handle($request->clientId(), $request->rows(), $request->allowDuplicates());

        return (new PartyImportResource($resultat))->response()->setStatusCode($resultat->replayed ? 200 : 201);
    }
}
