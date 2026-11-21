<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\AssignSupplier;
use App\Modules\Maintenance\Http\Requests\AssignSupplierRequest;
use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class AssignSupplierController
{
    public function __invoke(string $intervention, AssignSupplierRequest $request, AssignSupplier $action, Presenter $presenter): InterventionResource
    {
        $action->handle($intervention, $request->supplierPartyId(), $request->lockVersion());

        return $presenter->show($intervention);
    }
}
