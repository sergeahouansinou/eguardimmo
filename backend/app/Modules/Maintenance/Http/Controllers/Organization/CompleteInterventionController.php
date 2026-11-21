<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CompleteIntervention;
use App\Modules\Maintenance\Http\Requests\CompleteInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class CompleteInterventionController
{
    public function __invoke(string $intervention, CompleteInterventionRequest $request, CompleteIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->lockVersion(), $request->completedOn(), $request->note());

        return $presenter->show($intervention);
    }
}
