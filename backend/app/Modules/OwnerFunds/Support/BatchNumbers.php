<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Jurisdictions\OwnerFundsJurisdictions;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class BatchNumbers
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
        private OrganizationDirectory $organisations,
        private OwnerFundsJurisdictions $juridictions,
    ) {}

    /**
     * `RV-AAAA-NNNN`, continu par organisation et par année ; à appeler dans la transaction qui valide le lot.
     */
    public function next(CarbonImmutable $date): string
    {
        $numero = $this->compteur->next('owner_funds_sequences', [
            'organization_id' => $this->organisation->id(),
            'fiscal_year' => $date->year,
        ]);

        return sprintf('%s-%04d-%04d', $this->juridictions->for($this->organisations->country())->payoutPrefix(), $date->year, $numero);
    }
}
