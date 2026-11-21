<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Jurisdictions;

/**
 * Règles de fonds de mandants d'une juridiction (ADR 0008 : un contrat par juridiction, jamais de condition sur le pays).
 */
interface OwnerFundsRules
{
    public function jurisdiction(): string;

    /**
     * Préfixe du numéro de lot de reversements (`RV-AAAA-NNNN`).
     */
    public function payoutPrefix(): string;

    /**
     * Pays d'émission admis pour l'IBAN d'un compte de paiement (codes ISO 3166-1 alpha-2).
     *
     * @return list<string>
     */
    public function payoutIbanCountries(): array;
}
