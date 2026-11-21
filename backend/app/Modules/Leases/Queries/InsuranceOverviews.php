<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Documents\PublicApi\Certificates;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Support\InsuranceOverview;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class InsuranceOverviews
{
    public function __construct(
        private Certificates $pieces,
        private TenantInsuranceSubmissions $deposants,
        private InsuranceSubmissions $equipe,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Couverture du bail (visible de tous ses locataires) et dépôts de ce seul locataire.
     */
    public function forTenant(TenantStandingData $position): InsuranceOverview
    {
        return $this->contexte->run($position->organizationId, fn (): InsuranceOverview => new InsuranceOverview(
            $this->pieces->leaseCoverage($position->leaseId, CertificateTypeSemantic::HomeInsurance, CarbonImmutable::today()),
            $this->deposants->mine($position),
        ));
    }

    /**
     * Sous le contexte de l'organisation de l'équipe.
     */
    public function forTeam(string $leaseId): InsuranceOverview
    {
        return new InsuranceOverview(
            $this->pieces->leaseCoverage($leaseId, CertificateTypeSemantic::HomeInsurance, CarbonImmutable::today()),
            $this->equipe->ofLease($leaseId),
        );
    }
}
