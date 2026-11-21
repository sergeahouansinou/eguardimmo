<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Actions\UpdateInspection;
use App\Modules\Inspections\Http\Requests\UpdateInspectionRequest;
use App\Modules\Inspections\Http\Resources\InspectionResource;
use App\Modules\Inspections\Queries\Inspections;

final class UpdateInspectionController
{
    public function __invoke(string $inspection, UpdateInspectionRequest $request, Inspections $etats, UpdateInspection $action): InspectionResource
    {
        /** @var User $user */
        $user = $request->user();

        return new InspectionResource($action->handle($etats->get($inspection), $user, $request->lockVersion(), $request->changes()));
    }
}
