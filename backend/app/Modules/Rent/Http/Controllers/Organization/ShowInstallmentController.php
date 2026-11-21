<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Resources\InstallmentResource;
use App\Modules\Rent\Queries\Installments;
use App\Modules\Rent\Queries\InstallmentViews;
use Carbon\CarbonImmutable;

final class ShowInstallmentController
{
    public function __invoke(string $installment, Installments $echeances, InstallmentViews $vues): InstallmentResource
    {
        $echeance = $echeances->get($installment);

        return new InstallmentResource($echeance, $vues->of([$echeance], CarbonImmutable::today()));
    }
}
