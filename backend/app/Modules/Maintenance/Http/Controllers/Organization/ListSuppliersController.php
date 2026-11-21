<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Requests\ListSuppliersRequest;
use App\Modules\Maintenance\Http\Resources\SupplierPageResource;
use App\Modules\Maintenance\Queries\Suppliers;

final class ListSuppliersController
{
    public function __invoke(ListSuppliersRequest $request, Suppliers $prestataires): SupplierPageResource
    {
        $page = $prestataires->page($request->status(), $request->cursor(), $request->perPage());

        return new SupplierPageResource($page, $prestataires->parties($page->getCollection()));
    }
}
