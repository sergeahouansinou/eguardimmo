<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\PublicApi;

use App\Modules\Maintenance\Data\OwnerInvoiceShareData;
use App\Modules\Maintenance\Queries\OwnerInvoiceShares;
use Carbon\CarbonImmutable;

/**
 * Lecture des factures reçues imputées au propriétaire ; suppose un contexte d'organisation.
 */
final readonly class SupplierInvoiceDirectory
{
    public function __construct(private OwnerInvoiceShares $parts) {}

    /**
     * Factures non annulées d'un bien datées dans [from, toExclusive) qui portent une part imputée au propriétaire.
     *
     * @return list<OwnerInvoiceShareData>
     */
    public function ownerSharesForProperty(string $propertyId, CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        return $this->parts->forProperty($propertyId, $from, $toExclusive);
    }

    /**
     * Comme `ownerSharesForProperty()`, pour tous les biens de l'organisation, en une lecture.
     *
     * @return list<OwnerInvoiceShareData>
     */
    public function ownerSharesBetween(CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        return $this->parts->between($from, $toExclusive);
    }

    /**
     * @param  list<string>  $invoiceIds
     * @return list<OwnerInvoiceShareData> factures annulées ou sans part propriétaire absentes
     */
    public function ownerShares(array $invoiceIds): array
    {
        return $this->parts->many($invoiceIds);
    }
}
