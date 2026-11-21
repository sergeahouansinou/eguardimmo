<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\VatRegime;

/**
 * Identité légale du siège de l'organisation courante, telle qu'elle s'imprime sur une pièce émise.
 */
final readonly class LegalIdentityData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}  $address
     * @param  int|null  $shareCapital  unités mineures de `$currency`
     * @param  int|null  $guaranteeAmount  unités mineures de `$currency`
     */
    public function __construct(
        public string $organizationId,
        public string $country,
        public string $legalName,
        public array $address,
        public string $siren,
        public ?string $siret,
        public ?string $vatNumber,
        public ?string $legalForm,
        public ?int $shareCapital,
        public string $currency,
        public ?string $registryCity,
        public ?string $professionalCardNumber,
        public ?string $professionalCardIssuer,
        public ?string $guaranteeProvider,
        public ?int $guaranteeAmount,
        public VatRegime $vatRegime,
        public bool $vatOnDebits,
        public ?int $paymentTermsDays,
    ) {}
}
