<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Requests\ListInstallmentsRequest;
use App\Modules\Rent\Http\Resources\InstallmentPageResource;
use App\Modules\Rent\Queries\InstallmentList;
use App\Modules\Rent\Queries\InstallmentViews;
use Carbon\CarbonImmutable;

final class ListInstallmentsController
{
    public function __invoke(ListInstallmentsRequest $request, InstallmentList $liste, InstallmentViews $vues): InstallmentPageResource
    {
        $today = CarbonImmutable::today();
        $page = $liste->list($request->filters(), $request->perPage(), $today);

        return new InstallmentPageResource($page, $vues->of(array_values($page->items()), $today));
    }
}
