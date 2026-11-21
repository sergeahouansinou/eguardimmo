<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\OpenCase;
use App\Modules\Recovery\Http\Requests\OpenCaseRequest;
use App\Modules\Recovery\Http\Resources\CaseResource;
use App\Modules\Recovery\Queries\Cases;
use App\Modules\Recovery\Queries\CaseViews;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class OpenCaseController
{
    public function __invoke(OpenCaseRequest $request, OpenCase $ouvrir, Cases $dossiers, CaseViews $vues): JsonResponse
    {
        $ouvert = $dossiers->get($ouvrir->handle($request->toData(), CarbonImmutable::today())->id);

        return (new CaseResource($ouvert, $vues->of([$ouvert]), true))->response()->setStatusCode(201);
    }
}
