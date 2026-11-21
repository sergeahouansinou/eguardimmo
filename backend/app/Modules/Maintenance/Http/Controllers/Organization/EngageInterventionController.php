<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\EngageIntervention;
use App\Modules\Maintenance\Http\Requests\EngageInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class EngageInterventionController
{
    public function __invoke(string $intervention, EngageInterventionRequest $request, EngageIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->toData());

        return $presenter->show($intervention);
    }
}
