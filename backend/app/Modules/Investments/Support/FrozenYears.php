<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanUsage;

/**
 * Une année déjà figée dans une synthèse fiscale ne se réécrit pas : ni remboursement anticipé, ni import ne touchent ses échéances.
 */
final class FrozenYears
{
    public function assertEffectiveAfter(Loan $pret, string $date): void
    {
        $limite = $this->firstOpenDay($pret);

        if ($limite !== null && $date < $limite) {
            throw ErrorCode::LoanInUse->problem('Une synthèse fiscale figée s\'appuie sur les échéances de cette période.');
        }
    }

    /**
     * @param  list<ScheduleRowData>  $actuelles
     * @param  list<ScheduleRowData>  $nouvelles
     */
    public function assertUntouched(Loan $pret, array $actuelles, array $nouvelles): void
    {
        $limite = $this->firstOpenDay($pret);

        if ($limite === null) {
            return;
        }

        $figees = fn (array $lignes): array => array_values(array_map(
            fn (ScheduleRowData $l): string => implode('|', [$l->dueOn, $l->payment, $l->interest, $l->principal, $l->insurance, $l->outstandingAfter]),
            array_filter($lignes, fn (ScheduleRowData $l): bool => $l->dueOn < $limite),
        ));

        if ($figees($actuelles) !== $figees($nouvelles)) {
            throw ErrorCode::LoanInUse->problem('Une synthèse fiscale figée s\'appuie sur les échéances de cette période.');
        }
    }

    private function firstOpenDay(Loan $pret): ?string
    {
        $annee = LoanUsage::query()->where('loan_id', $pret->id)->max('income_year');

        return $annee === null ? null : sprintf('%04d-01-01', (int) $annee + 1);
    }
}
