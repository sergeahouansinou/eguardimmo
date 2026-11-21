<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\CreateChargeKey;
use App\Modules\Charges\Http\Requests\StoreChargeKeyRequest;
use App\Modules\Charges\Http\Resources\ChargeKeyResource;
use Illuminate\Http\JsonResponse;

final class StoreChargeKeyController
{
    public function __invoke(string $property, StoreChargeKeyRequest $request, CreateChargeKey $creer): JsonResponse
    {
        $cle = $creer->handle($property, $request->label(), $request->kind(), $request->validFrom(), $request->shares());

        return (new ChargeKeyResource($cle))->response()->setStatusCode(201);
    }
}
