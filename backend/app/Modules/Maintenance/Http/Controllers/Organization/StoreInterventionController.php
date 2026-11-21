<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CreateIntervention;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Http\Requests\StoreInterventionRequest;
use App\Modules\Maintenance\Http\Support\Presenter;
use App\Modules\Maintenance\Support\Operators;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreInterventionController
{
    public function __invoke(StoreInterventionRequest $request, CreateIntervention $creation, Presenter $presenter, Operators $operateurs): JsonResponse
    {
        $resultat = $creation->handle($request->toData(), InterventionOrigin::Team, null, 'team:'.$operateurs->userId(), CarbonImmutable::today());

        return $presenter->show($resultat['intervention']->id)->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
