<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Data\PayableInstallmentData;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Support\Settlement;

/**
 * Échéances appelées d'un bail dont le grand livre montre un reste dû ; suppose un contexte d'organisation.
 */
final readonly class PayableInstallments
{
    public function __construct(private Settlement $reglement) {}

    /**
     * @return list<PayableInstallmentData> par date d'échéance croissante
     */
    public function of(string $leaseId): array
    {
        $echeances = Installment::query()
            ->where('lease_id', $leaseId)
            ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
            ->orderBy('due_date')->orderBy('id')
            ->get();
        $restes = $this->reglement->outstanding(array_values($echeances->all()));
        $payables = [];

        foreach ($echeances as $echeance) {
            if ($restes[$echeance->id]->isPositive()) {
                $payables[] = new PayableInstallmentData($echeance->id, $echeance->due_date->toDateString(), $restes[$echeance->id]);
            }
        }

        return $payables;
    }

    public function recorded(string $idempotencyKey): bool
    {
        return Payment::query()->where('idempotency_key', $idempotencyKey)->exists();
    }
}
