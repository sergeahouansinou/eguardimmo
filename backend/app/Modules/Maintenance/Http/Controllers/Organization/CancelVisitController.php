<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CloseVisit;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Http\Resources\VisitResource;

final class CancelVisitController
{
    public function __invoke(string $intervention, string $visit, CloseVisit $action): VisitResource
    {
        return new VisitResource($action->handle($intervention, $visit, VisitStatus::Cancelled));
    }
}
