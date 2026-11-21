<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CancelIntervention;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Requests\OptionalLockVersionRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class CancelInterventionController
{
    public function __invoke(string $intervention, OptionalLockVersionRequest $request, CancelIntervention $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, ActorKind::Team, $request->lockVersion());

        return $presenter->show($intervention);
    }
}
