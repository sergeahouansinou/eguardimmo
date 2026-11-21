<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\QualifyIntervention;
use App\Modules\Maintenance\Http\Requests\QualifyInterventionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class QualifyInterventionController
{
    public function __invoke(string $intervention, QualifyInterventionRequest $request, QualifyIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->toData());

        return $presenter->show($intervention);
    }
}
