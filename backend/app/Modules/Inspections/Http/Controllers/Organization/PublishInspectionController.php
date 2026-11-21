<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Actions\PublishInspection;
use App\Modules\Inspections\Http\Resources\InspectionResource;
use App\Modules\Inspections\Queries\Inspections;
use Illuminate\Http\Request;

final class PublishInspectionController
{
    public function __invoke(string $inspection, Request $request, Inspections $etats, PublishInspection $action): InspectionResource
    {
        /** @var User $user */
        $user = $request->user();

        return new InspectionResource($action->handle($etats->get($inspection), $user));
    }
}
