<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\PublicApi;

use App\Modules\Invoicing\Data\InvoiceDocumentData;
use App\Modules\Invoicing\Data\UnpaidInvoiceData;
use App\Modules\Invoicing\Queries\IssuedInvoices;
use App\Modules\Invoicing\Queries\UnpaidInvoices;
use Carbon\CarbonImmutable;

/**
 * Lecture des factures pour Recovery ; suppose un contexte d'organisation. Les restes dus viennent du grand livre.
 */
final readonly class InvoiceLedger
{
    public function __construct(
        private UnpaidInvoices $impayees,
        private IssuedInvoices $emises,
    ) {}

    /**
     * Factures émises sur un bail à un débiteur partie au bail (créance locataire figée à l'émission), échues avant $asOf et non soldées, par identifiant croissant : repartir de
     * l'identifiant de la dernière reçue. $limit est plafonné à 500.
     *
     * @return list<UnpaidInvoiceData>
     */
    public function unpaidByLease(?CarbonImmutable $asOf = null, ?string $leaseId = null, ?string $afterId = null, int $limit = 100): array
    {
        return $this->impayees->overdue($asOf ?? CarbonImmutable::today(), $leaseId, $afterId, $limit);
    }

    /**
     * Facture émise de l'organisation courante ; lève invoice_not_found sinon (brouillon, avoir ou autre organisation).
     */
    public function find(string $invoiceId): InvoiceDocumentData
    {
        return $this->emises->find($invoiceId);
    }
}
