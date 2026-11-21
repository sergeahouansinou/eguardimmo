<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Support\Schedules;
use App\Modules\Rent\Support\Settlement;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class CancelInstallment
{
    public function __construct(
        private Schedules $echeanciers,
        private Settlement $reglement,
        private RecordAudit $audit,
    ) {}

    /**
     * Annule une échéance à venir, ou émise et sans encaissement (son appel de loyer est contrepassé). Une échéance
     * qui a reçu un encaissement ne s'annule qu'après l'annulation de celui-ci. La période reste prise : elle n'est
     * jamais régénérée.
     */
    public function handle(Installment $installment, string $reason, CarbonImmutable $today): Installment
    {
        return DB::transaction(function () use ($installment, $reason, $today): Installment {
            $this->echeanciers->lockExisting($installment->lease_id);
            $echeance = Installment::query()->whereKey($installment->id)->lockForUpdate()->firstOrFail();

            if ($echeance->status === InstallmentStatus::Cancelled) {
                return $echeance;
            }

            if ($echeance->status === InstallmentStatus::Paid || $echeance->status === InstallmentStatus::PartiallyPaid
                || PaymentAllocation::query()->where('installment_id', $echeance->id)->whereNull('reversed_at')->exists()) {
                throw ErrorCode::InstallmentHasPayments->problem();
            }

            if ($echeance->ledger_entry_id !== null) {
                $this->reglement->lockOwners([$echeance]);
                $this->reglement->reverse($echeance->ledger_entry_id, $today);
            }

            $echeance->status = InstallmentStatus::Cancelled;
            $echeance->cancelled_on = Carbon::instance($today);
            $echeance->cancellation_reason = $reason;
            $echeance->save();

            $this->audit->handle('rent.installment.cancelled', subject: $echeance, metadata: ['reason' => $reason]);

            return $echeance;
        });
    }
}
