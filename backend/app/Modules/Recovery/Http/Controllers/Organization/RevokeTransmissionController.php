<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\RevokeTransmission;
use App\Modules\Recovery\Http\Requests\RevokeRequest;
use App\Modules\Recovery\Http\Resources\TransmissionResource;
use App\Modules\Recovery\Queries\Transmissions;
use Carbon\CarbonImmutable;

final class RevokeTransmissionController
{
    public function __invoke(string $transmission, RevokeRequest $request, Transmissions $transmissions, RevokeTransmission $revoquer): TransmissionResource
    {
        return new TransmissionResource($revoquer->handle($transmissions->get($transmission), $request->reason(), CarbonImmutable::now()));
    }
}
