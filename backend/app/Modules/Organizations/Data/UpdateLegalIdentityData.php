<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\VatRegime;

final readonly class UpdateLegalIdentityData
{
    /**
     * @param  array{line1: string, line2: string|null, postal_code: string, city: string, country: string}  $address
     * @param  int|null  $shareCapital  unités mineures de la devise de l'organisation
     * @param  int|null  $guaranteeAmount  unités mineures de la devise de l'organisation
     */
    public function __construct(
        public string $legalName,
        public array $address,
        public string $siren,
        public ?string $siret,
        public ?string $vatNumber,
        public ?string $legalForm,
        public ?int $shareCapital,
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
