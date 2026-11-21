<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Enums\ScheduleReason;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanSchedule;
use App\Modules\Investments\Models\LoanScheduleLine;
use Illuminate\Support\Str;

/**
 * Chaque version contient l'échéancier entier du prêt : une version n'est jamais réécrite, la dernière fait foi.
 */
final class ScheduleWriter
{
    /**
     * @param  list<ScheduleRowData>  $rows
     */
    public function write(Loan $pret, array $rows, ScheduleReason $motif, string $effectiveFrom): LoanSchedule
    {
        $version = (int) LoanSchedule::query()->where('loan_id', $pret->id)->max('version') + 1;
        $schedule = LoanSchedule::query()->create(['loan_id' => $pret->id, 'version' => $version, 'effective_from' => $effectiveFrom, 'reason' => $motif->value]);
        $maintenant = now()->format('Y-m-d H:i:s.u');
        $lignes = [];

        foreach ($rows as $position => $r) {
            $lignes[] = [
                'id' => (string) Str::uuid7(), 'organization_id' => $pret->organization_id, 'loan_schedule_id' => $schedule->id, 'loan_id' => $pret->id,
                'position' => $position + 1, 'due_on' => $r->dueOn, 'currency' => $pret->currency, 'payment' => $r->payment, 'interest' => $r->interest,
                'principal' => $r->principal, 'insurance' => $r->insurance, 'outstanding_after' => $r->outstandingAfter, 'created_at' => $maintenant, 'updated_at' => $maintenant,
            ];
        }

        foreach (array_chunk($lignes, 100) as $lot) {
            LoanScheduleLine::query()->insert($lot);
        }

        return $schedule;
    }

    /**
     * @return list<ScheduleRowData> lignes de la dernière version
     */
    public function latest(string $loanId): array
    {
        $schedule = LoanSchedule::query()->where('loan_id', $loanId)->orderByDesc('version')->first();

        if ($schedule === null) {
            return [];
        }

        return array_values(LoanScheduleLine::query()->where('loan_schedule_id', $schedule->id)->orderBy('position')->get()
            ->map(fn (LoanScheduleLine $l): ScheduleRowData => new ScheduleRowData(
                $l->due_on->toDateString(), (int) $l->payment->getAmount(), (int) $l->interest->getAmount(), (int) $l->principal->getAmount(),
                (int) $l->insurance->getAmount(), (int) $l->outstanding_after->getAmount(),
            ))->all());
    }
}
