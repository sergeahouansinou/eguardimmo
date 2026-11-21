<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Documents\Enums\CoverageState;
use App\Modules\Documents\PublicApi\Certificates;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AssignSupplier
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private TermDirectory $termes,
        private Certificates $pieces,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Désigne le prestataire et attend un devis. L'assurance est bloquante seulement pour les natures qui l'exigent.
     *
     * @return array{intervention: Intervention, insurance: CoverageState}
     */
    public function handle(string $interventionId, string $supplierPartyId, int $lockVersion): array
    {
        return DB::transaction(function () use ($interventionId, $supplierPartyId, $lockVersion): array {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Qualified, InterventionStatus::Quoting);

            $profil = SupplierProfile::query()->where('party_id', $supplierPartyId)->first() ?? throw ErrorCode::SupplierNotFound->problem();

            if ($profil->status !== SupplierStatus::Active) {
                throw ErrorCode::SupplierUnavailable->problem();
            }

            if ($intervention->supplier_party_id !== null && $intervention->supplier_party_id !== $supplierPartyId
                && InterventionApproval::query()->where('intervention_id', $intervention->id)->where('status', ApprovalStatus::Pending->value)->exists()) {
                throw ErrorCode::ApprovalAlreadyPending->problem();
            }

            $couverture = $this->pieces->partyCoverage($supplierPartyId, CertificateTypeSemantic::ProfessionalLiability, CarbonImmutable::today());
            $nature = $this->termes->find($intervention->nature_term_id, VocabularyKey::InterventionNature);

            if (($nature->metadata['insurance_required'] ?? false) === true && $couverture === CoverageState::Missing) {
                throw ErrorCode::SupplierInsuranceMissing->problem();
            }

            $this->transitions->apply($intervention, InterventionStatus::Quoting, ['supplier_party_id' => $supplierPartyId]);
            $this->chronologie->add($intervention, EventKind::SupplierAssigned, ActorKind::Team, 'Prestataire désigné.');
            $this->audit->handle('maintenance.intervention.supplier_assigned', subject: $intervention, metadata: ['supplier_party_id' => $supplierPartyId, 'insurance' => $couverture->value]);

            return ['intervention' => $intervention, 'insurance' => $couverture];
        });
    }
}
