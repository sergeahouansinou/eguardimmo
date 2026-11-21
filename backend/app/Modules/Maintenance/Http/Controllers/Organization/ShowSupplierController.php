<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Resources\SupplierResource;
use App\Modules\Maintenance\Queries\Suppliers;

final class ShowSupplierController
{
    public function __invoke(string $supplier, Suppliers $prestataires): SupplierResource
    {
        $profil = $prestataires->get($supplier);

        return new SupplierResource($profil, $prestataires->parties([$profil])[$profil->party_id] ?? null);
    }
}
