<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Models\AdvanceRefund;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

/**
 * Trop-perçu d'un bail : la part d'un encaissement qui n'a été imputée sur aucune échéance. À l'appel d'une échéance,
 * l'avance la plus ancienne s'y impute d'elle-même.
 */
final readonly class Advances
{
    public function __construct(private Settlement $reglement) {}

    /**
     * @return list<array{payment: Payment, remaining: Money}> avances disponibles, la plus ancienne d'abord
     */
    public function available(string $leaseId, Currency $devise): array
    {
        $paiements = Payment::query()
            ->where('lease_id', $leaseId)
            ->where('status', PaymentStatus::Recorded->value)
            ->where('currency', $devise->getCode())
            ->orderBy('received_on')->orderBy('created_at')->orderBy('id')
            ->get();

        if ($paiements->isEmpty()) {
            return [];
        }

        $imputes = PaymentAllocation::query()
            ->whereIn('payment_id', $paiements->modelKeys())
            ->whereNull('reversed_at')
            ->selectRaw('payment_id, sum(amount) as total')
            ->groupBy('payment_id')
            ->pluck('total', 'payment_id');
        $rendus = AdvanceRefund::query()->whereIn('payment_id', $paiements->modelKeys())->selectRaw('payment_id, sum(amount) as total')->groupBy('payment_id')->pluck('total', 'payment_id');
        $avances = [];

        foreach ($paiements as $paiement) {
            $reste = $paiement->amount->subtract(new Money((int) ($imputes[$paiement->id] ?? 0) + (int) ($rendus[$paiement->id] ?? 0), $devise));

            if ($reste->isPositive()) {
                $avances[] = ['payment' => $paiement, 'remaining' => $reste];
            }
        }

        return $avances;
    }

    /**
     * Impute les avances sur les échéances ouvertes du bail, la plus ancienne d'abord, une écriture par imputation pour
     * que l'annulation d'un encaissement ne contrepasse que ses propres parts.
     *
     * @return list<Installment> les échéances qui ont reçu une part
     */
    public function apply(string $leaseId, Currency $devise, CarbonImmutable $today): array
    {
        $ouvertes = $this->reglement->lockedOpen($leaseId);

        if ($ouvertes === []) {
            return [];
        }

        $avances = $this->available($leaseId, $devise);

        if ($avances === []) {
            return [];
        }

        $restes = $this->reglement->outstanding($ouvertes);
        $touchees = [];

        foreach ($ouvertes as $echeance) {
            foreach ($avances as $i => $avance) {
                $du = $restes[$echeance->id];

                if (! $du->isPositive()) {
                    break;
                }

                $part = $avance['remaining']->lessThan($du) ? $avance['remaining'] : $du;

                if (! $part->isPositive()) {
                    continue;
                }

                $ecriture = $this->reglement->postAdvanceApplication($echeance, $avance['payment']->id, $part, $today, 'rent:advance:'.Str::uuid7());
                PaymentAllocation::query()->create([
                    'payment_id' => $avance['payment']->id,
                    'installment_id' => $echeance->id,
                    'amount' => $part,
                    'currency' => $devise->getCode(),
                    'ledger_entry_id' => $ecriture->id,
                ]);

                $avances[$i]['remaining'] = $avance['remaining']->subtract($part);
                $restes[$echeance->id] = $du->subtract($part);
                $touchees[$echeance->id] = $echeance;
            }
        }

        foreach ($touchees as $echeance) {
            $this->reglement->sync($echeance, $restes[$echeance->id]);
        }

        return array_values($touchees);
    }
}
