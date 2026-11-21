<?php

declare(strict_types=1);

namespace App\Modules\Payments\Queries;

use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Models\OnlinePayment;
use App\Modules\Rent\PublicApi\RentLedger;

/**
 * Échéances déjà engagées dans un paiement en ligne du bail, toutes fiches confondues : intention en attente ou en cours, ou réussie
 * mais pas encore imputée au grand livre. Sous le contexte de l'organisation.
 */
final readonly class CoveredInstallments
{
    public function __construct(private RentLedger $loyers) {}

    /**
     * @return array<string, true> identifiants d'échéance
     */
    public function of(string $leaseId): array
    {
        $couvertes = [];
        $intentions = OnlinePayment::query()
            ->where('lease_id', $leaseId)
            ->whereIn('status', [OnlinePaymentStatus::Pending->value, OnlinePaymentStatus::Processing->value, OnlinePaymentStatus::Succeeded->value])
            ->get();

        foreach ($intentions as $intention) {
            if ($intention->status === OnlinePaymentStatus::Succeeded && $this->loyers->isRecorded('psp:'.$intention->provider.':'.$intention->provider_reference)) {
                continue;
            }

            foreach ($intention->installment_ids as $id) {
                $couvertes[(string) $id] = true;
            }
        }

        return $couvertes;
    }
}
