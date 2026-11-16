<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\ArchiveLease;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class ArchiveLeaseController
{
    public function __invoke(string $lease, Leases $baux, ArchiveLease $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease))->id));
    }
}
