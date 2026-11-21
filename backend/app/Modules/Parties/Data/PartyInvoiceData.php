<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\PartyKind;

/**
 * Ce qu'une facture imprime d'un destinataire : lu une seule fois à l'émission, jamais relu ensuite (ADR 0022).
 */
final readonly class PartyInvoiceData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null  $address
     */
    public function __construct(
        public string $id,
        public string $displayName,
        public PartyKind $kind,
        public ?array $address,
        public ?string $siren,
        public ?string $siret,
        public ?string $vatNumber,
        public ?string $primaryEmail,
        public bool $isAnonymized,
    ) {}
}
