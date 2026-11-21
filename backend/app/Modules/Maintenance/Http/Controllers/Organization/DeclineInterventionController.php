<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\DeclineIntervention;
use App\Modules\Maintenance\Http\Requests\DeclineInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class DeclineInterventionController
{
    public function __invoke(string $intervention, DeclineInterventionRequest $request, DeclineIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->lockVersion(), $request->reason(), $request->note());

        return $presenter->show($intervention);
    }
}
