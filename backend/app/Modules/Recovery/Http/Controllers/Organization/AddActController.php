<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\AddAct;
use App\Modules\Recovery\Http\Requests\AddActRequest;
use App\Modules\Recovery\Http\Resources\ActResource;
use App\Modules\Recovery\Queries\Cases;
use Illuminate\Http\JsonResponse;

final class AddActController
{
    public function __invoke(string $case, AddActRequest $request, Cases $dossiers, AddAct $ajouter): JsonResponse
    {
        return (new ActResource($ajouter->handle($dossiers->find($case), $request->toData())))->response()->setStatusCode(201);
    }
}
