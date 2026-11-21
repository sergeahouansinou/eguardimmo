<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\CancelInstallment;
use App\Modules\Rent\Http\Requests\ReasonRequest;
use App\Modules\Rent\Http\Resources\InstallmentResource;
use App\Modules\Rent\Queries\Installments;
use App\Modules\Rent\Queries\InstallmentViews;
use Carbon\CarbonImmutable;

final class CancelInstallmentController
{
    public function __invoke(string $installment, ReasonRequest $request, Installments $echeances, CancelInstallment $annuler, InstallmentViews $vues): InstallmentResource
    {
        $today = CarbonImmutable::today();
        $annuler->handle($echeances->get($installment), $request->reason(), $today);
        $echeance = $echeances->get($installment);

        return new InstallmentResource($echeance, $vues->of([$echeance], $today));
    }
}
