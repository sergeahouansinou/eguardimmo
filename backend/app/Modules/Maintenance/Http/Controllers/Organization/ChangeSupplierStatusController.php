<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\ChangeSupplierStatus;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Http\Resources\SupplierResource;
use App\Modules\Maintenance\Queries\Suppliers;

final class ChangeSupplierStatusController
{
    public function __invoke(string $supplier, string $status, ChangeSupplierStatus $action, Suppliers $prestataires): SupplierResource
    {
        $action->handle($supplier, SupplierStatus::from($status));
        $profil = $prestataires->get($supplier);

        return new SupplierResource($profil, $prestataires->parties([$profil])[$profil->party_id] ?? null);
    }
}
