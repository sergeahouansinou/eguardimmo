<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\ConfirmVisit;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Resources\VisitResource;

final class ConfirmVisitController
{
    public function __invoke(string $intervention, string $visit, ConfirmVisit $action): VisitResource
    {
        return new VisitResource($action->handle($intervention, $visit, ActorKind::Team));
    }
}
