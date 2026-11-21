<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CancelAllocation;
use App\Modules\Maintenance\Http\Resources\AllocationResource;

final class CancelAllocationController
{
    public function __invoke(string $allocation, CancelAllocation $action): AllocationResource
    {
        return new AllocationResource($action->handle($allocation));
    }
}
