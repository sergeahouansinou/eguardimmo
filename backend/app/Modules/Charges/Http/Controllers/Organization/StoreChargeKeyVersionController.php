<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\AddChargeKeyVersion;
use App\Modules\Charges\Http\Requests\StoreKeyVersionRequest;
use App\Modules\Charges\Http\Resources\ChargeKeyResource;
use Illuminate\Http\JsonResponse;

final class StoreChargeKeyVersionController
{
    public function __invoke(string $property, string $key, StoreKeyVersionRequest $request, AddChargeKeyVersion $ajouter): JsonResponse
    {
        $cle = $ajouter->handle($property, $key, $request->validFrom(), $request->shares());

        return (new ChargeKeyResource($cle))->response()->setStatusCode(201);
    }
}
