<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\TransmitBundle;
use App\Modules\Recovery\Http\Requests\TransmitRequest;
use App\Modules\Recovery\Http\Resources\TransmissionResource;
use App\Modules\Recovery\Queries\Bundles;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class TransmitBundleController
{
    public function __invoke(string $bundle, TransmitRequest $request, Bundles $envois, TransmitBundle $transmettre): JsonResponse
    {
        $transmission = $transmettre->handle($envois->get($bundle), $request->recipientPartyId(), $request->validDays(), CarbonImmutable::now());

        return (new TransmissionResource($transmission))->response()->setStatusCode(201);
    }
}
