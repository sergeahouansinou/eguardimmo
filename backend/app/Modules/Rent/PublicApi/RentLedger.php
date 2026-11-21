<?php

declare(strict_types=1);

namespace App\Modules\Rent\PublicApi;

use App\Modules\Rent\Data\InstallmentNoticeData;
use App\Modules\Rent\Data\LeaseRentBalanceData;
use App\Modules\Rent\Data\PayableInstallmentData;
use App\Modules\Rent\Data\UnpaidInstallmentData;
use App\Modules\Rent\Queries\InstallmentNotices;
use App\Modules\Rent\Queries\LeaseBalances;
use App\Modules\Rent\Queries\PayableInstallments;
use App\Modules\Rent\Queries\UnpaidInstallments;
use Carbon\CarbonImmutable;

/**
 * Lecture des loyers pour Recovery et Reporting ; suppose un contexte d'organisation. Les montants viennent du grand livre.
 */
final readonly class RentLedger
{
    public function __construct(
        private LeaseBalances $soldes,
        private UnpaidInstallments $impayes,
        private InstallmentNotices $avis,
        private PayableInstallments $payables,
    ) {}

    /**
     * Lève lease_not_found hors de l'organisation courante.
     */
    public function leaseBalance(string $leaseId, ?CarbonImmutable $asOf = null): LeaseRentBalanceData
    {
        return $this->soldes->of($leaseId, $asOf ?? CarbonImmutable::today());
    }

    /**
     * Échéances appelées, non soldées et échues avant $asOf, par identifiant croissant : repartir de l'identifiant de la
     * dernière reçue. $limit est plafonné à 500.
     *
     * @return list<UnpaidInstallmentData>
     */
    public function unpaidInstallments(?CarbonImmutable $asOf = null, ?string $leaseId = null, ?string $afterId = null, int $limit = 100): array
    {
        return $this->impayes->overdue($asOf ?? CarbonImmutable::today(), $leaseId, $afterId, $limit);
    }

    /**
     * Avis d'échéance émis de ces échéances (fichier stocké, numéro, empreinte) ; une échéance sans avis est absente.
     *
     * @param  list<string>  $installmentIds
     * @return array<string, InstallmentNoticeData> par échéance
     */
    public function noticesOf(array $installmentIds): array
    {
        return $this->avis->of($installmentIds);
    }

    /**
     * Échéances appelées d'un bail avec un reste dû strictement positif, lues au grand livre, par date d'échéance croissante.
     *
     * @return list<PayableInstallmentData>
     */
    public function payableInstallments(string $leaseId): array
    {
        return $this->payables->of($leaseId);
    }

    /**
     * Vrai si un encaissement porte déjà cette clé d'idempotence (`psp:{fournisseur}:{référence}` pour un paiement en ligne).
     */
    public function isRecorded(string $idempotencyKey): bool
    {
        return $this->payables->recorded($idempotencyKey);
    }
}
