<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\ResendTransmission;
use App\Modules\Recovery\Http\Requests\ResendRequest;
use App\Modules\Recovery\Http\Resources\TransmissionResource;
use App\Modules\Recovery\Queries\Transmissions;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ResendTransmissionController
{
    public function __invoke(string $transmission, ResendRequest $request, Transmissions $transmissions, ResendTransmission $renvoyer): JsonResponse
    {
        $nouvelle = $renvoyer->handle($transmissions->get($transmission), $request->validDays(), CarbonImmutable::now());

        return (new TransmissionResource($nouvelle))->response()->setStatusCode(201);
    }
}
