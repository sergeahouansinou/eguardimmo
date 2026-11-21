<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\PublicApi\Certificates;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Events\LeaseInsuranceDecided;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AcceptLeaseInsurance
{
    public function __construct(
        private Certificates $pieces,
        private RecordAudit $audit,
    ) {}

    /**
     * Crée la pièce d'assurance du bail dans la même transaction : un dépôt accepté sans pièce, ou l'inverse, n'existe pas.
     */
    public function handle(LeaseInsuranceSubmission $depot, User $acteur): LeaseInsuranceSubmission
    {
        $accepte = DB::transaction(function () use ($depot, $acteur): LeaseInsuranceSubmission {
            $verrouille = LeaseInsuranceSubmission::query()->whereKey($depot->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->status !== InsuranceSubmissionStatus::Pending) {
                throw ErrorCode::InsuranceSubmissionNotPending->problem();
            }

            if ($verrouille->ends_on->lessThan(today())) {
                throw ErrorCode::InsurancePeriodInvalid->problem('Cette attestation est déjà échue : refusez-la avec le motif « échue ».');
            }

            $pieceId = $this->pieces->record(
                new DocumentSubject('lease', $verrouille->lease_id),
                CertificateTypeSemantic::HomeInsurance,
                CarbonImmutable::parse($verrouille->starts_on->toDateString()),
                CarbonImmutable::parse($verrouille->ends_on->toDateString()),
                $verrouille->stored_file_id,
            );

            $verrouille->forceFill(['status' => InsuranceSubmissionStatus::Accepted, 'decided_by_user_id' => $acteur->id, 'decided_at' => now(), 'certificate_id' => $pieceId])->save();
            $this->audit->handle('leases.insurance.accepted', $acteur->id, [], $verrouille);

            return $verrouille;
        });

        LeaseInsuranceDecided::dispatch($accepte->id, $accepte->lease_id, $accepte->organization_id, $accepte->party_id, true);

        return $accepte;
    }
}
