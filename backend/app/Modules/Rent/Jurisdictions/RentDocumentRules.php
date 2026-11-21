<?php

declare(strict_types=1);

namespace App\Modules\Rent\Jurisdictions;

/**
 * Mentions et version de modèle de l'avis d'échéance et de la quittance d'une juridiction (ADR 0008 : une interface
 * par contrat de juridiction, jamais de condition sur le pays).
 */
interface RentDocumentRules
{
    public function jurisdiction(): string;

    public function templateVersion(): string;

    public function noticeMention(): string;

    public function receiptMention(): string;
}
