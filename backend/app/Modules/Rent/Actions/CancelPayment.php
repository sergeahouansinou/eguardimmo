<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Events\PaymentCancelled;
use App\Modules\Rent\Models\AdvanceRefund;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Models\RentReceipt;
use App\Modules\Rent\Support\Schedules;
use App\Modules\Rent\Support\Settlement;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class CancelPayment
{
    public function __construct(
        private Schedules $echeanciers,
        private Settlement $reglement,
        private RecordAudit $audit,
    ) {}

    /**
     * Annule un encaissement sans rien supprimer : chaque écriture qui l'a imputé est contrepassée, ses imputations sont
     * closes, les échéances reprennent le statut que dit le grand livre, et une quittance devenue fausse est déclarée
     * nulle. Rejouable : un encaissement déjà annulé est renvoyé tel quel.
     */
    public function handle(Payment $payment, string $reason, CarbonImmutable $today): Payment
    {
        return DB::transaction(function () use ($payment, $reason, $today): Payment {
            $this->echeanciers->lockExisting($payment->lease_id);
            $paiement = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if ($paiement->status === PaymentStatus::Cancelled) {
                return $paiement;
            }

            if ($paiement->method === PaymentMethod::ChargeCredit || AdvanceRefund::query()->where('payment_id', $paiement->id)->exists()) {
                throw ErrorCode::PaymentNotCancellable->problem();
            }

            $imputations = PaymentAllocation::query()->where('payment_id', $paiement->id)->whereNull('reversed_at')->get();
            $echeances = $imputations->isEmpty() ? [] : array_values(Installment::query()
                ->whereIn('id', $imputations->pluck('installment_id')->all())
                ->orderBy('due_date')->orderBy('period_start')->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->all());

            $this->reglement->lockOwners($echeances);

            $ecritures = array_values(array_unique(array_filter(
                $imputations->pluck('ledger_entry_id')->all(),
                fn (string $id): bool => $id !== $paiement->ledger_entry_id,
            )));

            foreach ([...$ecritures, $paiement->ledger_entry_id] as $ecriture) {
                if (is_string($ecriture)) {
                    $this->reglement->reverse($ecriture, $today);
                }
            }

            foreach ($imputations as $imputation) {
                $imputation->reversed_at = now();
                $imputation->save();
            }

            $paiement->status = PaymentStatus::Cancelled;
            $paiement->cancelled_on = Carbon::instance($today);
            $paiement->cancellation_reason = $reason;
            $paiement->save();

            $restes = $this->reglement->outstanding($echeances);

            foreach ($echeances as $echeance) {
                $this->reglement->sync($echeance, $restes[$echeance->id]);

                if ($echeance->status->isOpen()) {
                    $this->voidReceipts($echeance);
                }
            }

            $this->audit->handle('rent.payment.cancelled', subject: $paiement, metadata: ['reason' => $reason, 'reversed_entries' => count($ecritures) + 1]);
            PaymentCancelled::dispatch($paiement->id, $paiement->lease_id, $paiement->organization_id);

            return $paiement;
        });
    }

    private function voidReceipts(Installment $echeance): void
    {
        foreach (RentReceipt::query()->where('installment_id', $echeance->id)->whereNull('voided_at')->get() as $quittance) {
            $quittance->voided_at = now();
            $quittance->void_reason = 'Encaissement annulé : l\'échéance n\'est plus soldée.';
            $quittance->save();
        }
    }
}
