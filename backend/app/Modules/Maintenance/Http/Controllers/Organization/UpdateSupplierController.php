<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\UpdateSupplier;
use App\Modules\Maintenance\Http\Requests\UpdateSupplierRequest;
use App\Modules\Maintenance\Http\Resources\SupplierResource;
use App\Modules\Maintenance\Queries\Suppliers;

final class UpdateSupplierController
{
    public function __invoke(string $supplier, UpdateSupplierRequest $request, UpdateSupplier $action, Suppliers $prestataires): SupplierResource
    {
        $action->handle($supplier, $request->toData());
        $profil = $prestataires->get($supplier);

        return new SupplierResource($profil, $prestataires->parties([$profil])[$profil->party_id] ?? null);
    }
}
