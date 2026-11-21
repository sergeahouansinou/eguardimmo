<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Http\Resources\ActivityDetailResource;
use App\Modules\Organizations\Queries\OrganizationActivity;

final class ShowActivityController
{
    public function __invoke(string $activity, OrganizationActivity $journal): ActivityDetailResource
    {
        return new ActivityDetailResource($journal->find($activity));
    }
}
