<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\RecordNotice;
use App\Modules\Leases\Http\Requests\RecordNoticeRequest;
use App\Modules\Leases\Http\Resources\LeaseResource;
use App\Modules\Leases\Queries\LeaseDetails;
use App\Modules\Leases\Queries\Leases;

final class RecordNoticeController
{
    public function __invoke(string $lease, RecordNoticeRequest $request, Leases $baux, RecordNotice $action, LeaseDetails $details): LeaseResource
    {
        return new LeaseResource($details->get($action->handle($baux->get($lease), $request->toData())->id));
    }
}
