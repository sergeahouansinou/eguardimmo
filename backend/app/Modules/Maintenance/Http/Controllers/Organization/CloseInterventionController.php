<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CloseIntervention;
use App\Modules\Maintenance\Http\Requests\CloseInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class CloseInterventionController
{
    public function __invoke(string $intervention, CloseInterventionRequest $request, CloseIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->lockVersion(), $request->reason());

        return $presenter->show($intervention);
    }
}
