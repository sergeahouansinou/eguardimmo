<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Controllers\Marketplace;

use App\Modules\Listings\Actions\RequestVisit;
use App\Modules\Listings\Http\Requests\StoreVisitRequestRequest;
use App\Modules\Listings\Http\Resources\VisitRequestResource;
use Illuminate\Http\JsonResponse;

final class StoreVisitRequestController
{
    public function __invoke(string $ref, StoreVisitRequestRequest $request, RequestVisit $demander): JsonResponse
    {
        $demande = $demander->handle((string) $request->user()?->getAuthIdentifier(), $ref, $request->toData());

        return (new VisitRequestResource($demande))->response()->setStatusCode(201);
    }
}
