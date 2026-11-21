<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\AddMandateUnit;
use App\Modules\Mandates\Http\Requests\AddMandateUnitRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;
use Illuminate\Http\JsonResponse;

final class AddMandateUnitController
{
    public function __invoke(string $mandate, AddMandateUnitRequest $request, Mandates $mandats, AddMandateUnit $ajouter, MandateViews $views): JsonResponse
    {
        $courant = $mandats->get($mandate);
        $ajouter->handle($courant, $request->toData());

        return (new MandateResource($views->find($courant->id)))->response()->setStatusCode(201);
    }
}
