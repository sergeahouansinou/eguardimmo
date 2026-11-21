<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\PublicApi;

use App\Modules\Invoicing\Data\FeeCreditData;
use App\Modules\Invoicing\Data\FeeInvoiceData;
use App\Modules\Invoicing\Data\FeeInvoiceRequestData;
use App\Modules\Invoicing\Support\ManagementFees;
use Carbon\CarbonImmutable;

/**
 * Factures d'honoraires de gestion générées par le serveur pour OwnerFunds (ADR 0031, décision 3) : émission, compensation
 * sur le compte du mandant et avoir. Suppose un contexte d'organisation ; chaque appel s'exécute dans la transaction de
 * l'appelant, qui a déjà pris le verrou du compte mandant.
 */
final readonly class ManagementFeeInvoices
{
    public function __construct(private ManagementFees $honoraires) {}

    /**
     * Taux de TVA des honoraires de gestion à la date (cent-millièmes, 100 000 = 100 %) ; 0 en franchise.
     */
    public function vatRatePcm(CarbonImmutable $date): int
    {
        return $this->honoraires->vatRatePcm($date);
    }

    /**
     * Brouillon puis émission de la facture du relevé, ou la facture déjà émise (rejeu).
     */
    public function issue(FeeInvoiceRequestData $demande, CarbonImmutable $today): FeeInvoiceData
    {
        return $this->honoraires->issue($demande, $today);
    }

    /**
     * Règle la facture sur le compte du mandant, à hauteur de min(reste dû, `$maxMinor`) ; retourne le montant compensé.
     */
    public function settleFromOwnerAccount(string $invoiceId, int $maxMinor, string $idempotencyKey, CarbonImmutable $today): int
    {
        return $this->honoraires->settleFromOwnerAccount($invoiceId, $maxMinor, $idempotencyKey, $today);
    }

    /**
     * Reste dû en TTC d'une facture d'honoraires émise (0 si elle n'existe pas ou n'est plus due).
     */
    public function outstanding(string $invoiceId): int
    {
        return $this->honoraires->outstanding($invoiceId);
    }

    /**
     * Avoir d'au plus `$netMinor` hors taxe sur la dernière facture d'honoraires du mandat, dans la limite de ce qui reste
     * créditable. Retourne null quand rien ne se crédite : le montant est alors à reporter.
     */
    public function creditLatest(string $mandateId, int $netMinor, string $idempotencyKey, string $reason, CarbonImmutable $today): ?FeeCreditData
    {
        return $this->honoraires->creditLatest($mandateId, $netMinor, $idempotencyKey, $reason, $today);
    }
}
