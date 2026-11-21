<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\UpdateIntervention;
use App\Modules\Maintenance\Http\Requests\UpdateInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class UpdateInterventionController
{
    public function __invoke(string $intervention, UpdateInterventionRequest $request, UpdateIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->toData());

        return $presenter->show($intervention);
    }
}
