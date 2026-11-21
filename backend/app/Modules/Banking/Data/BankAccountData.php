<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use App\Modules\Banking\Enums\IdentifierKind;
use App\Modules\Banking\Enums\LedgerRole;
use Carbon\CarbonImmutable;
use SensitiveParameter;

/**
 * Compte à suivre tel que reçu du client : l'identifiant ne vit que le temps de la requête. La devise est celle de l'organisation.
 */
final readonly class BankAccountData
{
    /**
     * @param  array<string, mixed>|null  $csvProfile
     */
    public function __construct(
        public ?LedgerRole $ledgerRole,
        public string $label,
        public ?string $bankName,
        public string $holderName,
        public IdentifierKind $identifierKind,
        #[SensitiveParameter] public string $identifier,
        public ?string $country,
        public CarbonImmutable $reconciliationFrom,
        public int $openingBankBalance,
        public ?array $csvProfile,
    ) {}
}
