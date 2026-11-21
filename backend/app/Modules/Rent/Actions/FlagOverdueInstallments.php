<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Events\InstallmentOverdue;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class FlagOverdueInstallments
{
    private const int LOT = 200;

    /**
     * Signale une fois chaque échéance appelée dont la date est dépassée et qui n'est pas soldée ; suppose un contexte
     * d'organisation. Rejouable : une échéance déjà signalée n'est plus sélectionnée.
     */
    public function handle(CarbonImmutable $today): int
    {
        $total = 0;

        do {
            $traitees = DB::transaction(function () use ($today): int {
                $echeances = Installment::query()
                    ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
                    ->where('due_date', '<', $today->toDateString())
                    ->whereNull('overdue_notified_at')
                    ->orderBy('id')
                    ->limit(self::LOT)
                    ->lockForUpdate()
                    ->get();

                foreach ($echeances as $echeance) {
                    $echeance->overdue_notified_at = now();
                    $echeance->save();
                    InstallmentOverdue::dispatch($echeance->id, $echeance->lease_id, $echeance->organization_id, $echeance->due_date->toDateString());
                }

                return $echeances->count();
            });
            $total += $traitees;
        } while ($traitees === self::LOT);

        return $total;
    }
}
