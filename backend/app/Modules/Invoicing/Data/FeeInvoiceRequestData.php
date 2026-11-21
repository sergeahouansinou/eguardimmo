<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

use Carbon\CarbonImmutable;

final readonly class FeeInvoiceRequestData
{
    /**
     * @param  string  $statementId  relevé d'honoraires (une facture au plus par relevé)
     * @param  CarbonImmutable  $periodStart  premier jour du mois facturé
     * @param  CarbonImmutable  $periodEnd  dernier jour du mois facturé
     * @param  int  $netMinor  honoraires hors taxe, unités mineures de la devise de l'organisation
     */
    public function __construct(
        public string $statementId,
        public string $mandantPartyId,
        public string $mandateId,
        public CarbonImmutable $periodStart,
        public CarbonImmutable $periodEnd,
        public int $netMinor,
        public string $description,
    ) {}
}
