<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\NewInterventionData;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\TenantInterventions;
use App\Modules\Maintenance\Support\TenantAccess;
use Carbon\CarbonImmutable;

final readonly class ReportServiceRequest
{
    public function __construct(
        private TenantAccess $acces,
        private TenantInterventions $lecture,
        private CreateIntervention $creation,
    ) {}

    /**
     * Signalement du locataire : le bail doit faire partie de ceux que Leases lui rend visibles, l'organisation en découle.
     *
     * @return array{intervention: Intervention, replayed: bool}
     */
    public function handle(string $userId, NewInterventionData $donnees): array
    {
        $cle = $this->lecture->key($this->acces->keys($userId), (string) $donnees->leaseId);
        $signalant = $this->acces->reporter($userId, $cle->organizationId, $cle->leaseId);

        return $this->acces->within($cle->organizationId, fn (): array => $this->creation->handle($donnees, InterventionOrigin::Tenant, $signalant, 'tenant:'.$userId, CarbonImmutable::today()));
    }
}
