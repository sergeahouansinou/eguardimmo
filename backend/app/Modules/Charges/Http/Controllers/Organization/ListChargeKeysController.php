<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Resources\ChargeKeyResource;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ListChargeKeysController
{
    public function __invoke(Request $request, string $property, UnitDirectory $lots): JsonResponse
    {
        $lots->ofProperty($property);
        $cles = ChargeKey::query()->where('property_id', $property)->with('versions.shares')->orderBy('label')->orderBy('id')->get();

        return new JsonResponse(['data' => $cles->map(fn (ChargeKey $c): array => (new ChargeKeyResource($c))->toArray($request))->values()->all()]);
    }
}
