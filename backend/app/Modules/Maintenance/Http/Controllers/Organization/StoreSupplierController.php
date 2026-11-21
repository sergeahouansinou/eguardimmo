<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CreateSupplier;
use App\Modules\Maintenance\Http\Requests\StoreSupplierRequest;
use App\Modules\Maintenance\Http\Resources\SupplierResource;
use App\Modules\Maintenance\Queries\Suppliers;
use Illuminate\Http\JsonResponse;

final class StoreSupplierController
{
    public function __invoke(StoreSupplierRequest $request, CreateSupplier $action, Suppliers $prestataires): JsonResponse
    {
        $profil = $prestataires->get($action->handle($request->toData())->id);

        return (new SupplierResource($profil, $prestataires->parties([$profil])[$profil->party_id] ?? null))->response()->setStatusCode(201);
    }
}
