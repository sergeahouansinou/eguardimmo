<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\ReopenIntervention;
use App\Modules\Maintenance\Http\Requests\LockVersionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class ReopenInterventionController
{
    public function __invoke(string $intervention, LockVersionRequest $request, ReopenIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->lockVersion());

        return $presenter->show($intervention);
    }
}
