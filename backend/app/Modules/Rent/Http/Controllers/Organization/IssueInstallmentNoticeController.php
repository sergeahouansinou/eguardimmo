<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\IssueNotice;
use App\Modules\Rent\Actions\IssueSettledReceipts;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Http\Resources\InstallmentResource;
use App\Modules\Rent\Queries\Installments;
use App\Modules\Rent\Queries\InstallmentViews;
use Carbon\CarbonImmutable;

final class IssueInstallmentNoticeController
{
    public function __invoke(string $installment, Installments $echeances, IssueNotice $emettre, IssueSettledReceipts $quittances, InstallmentViews $vues): InstallmentResource
    {
        $today = CarbonImmutable::today();
        $emise = $emettre->handle($echeances->get($installment), $today);

        if ($emise->status === InstallmentStatus::Paid) {
            $quittances->handle([$emise], $today);
        }

        $echeance = $echeances->get($installment);

        return new InstallmentResource($echeance, $vues->of([$echeance], $today));
    }
}
