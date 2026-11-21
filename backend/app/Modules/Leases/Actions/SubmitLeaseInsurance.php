<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Events\LeaseInsuranceSubmitted;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class SubmitLeaseInsurance
{
    public function __construct(
        private DocumentStore $fichiers,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Le dépôt est une demande : aucune pièce n'est créée avant l'acceptation de l'agence. Rejouable par `client_id`.
     *
     * @return array{submission: LeaseInsuranceSubmission, replayed: bool}
     */
    public function handle(TenantStandingData $position, User $user, FileSource $source, string $nomFichier, string $insurer, string $policyNumber, CarbonImmutable $startsOn, CarbonImmutable $endsOn, string $clientId): array
    {
        return $this->contexte->run($position->organizationId, function () use ($position, $user, $source, $nomFichier, $insurer, $policyNumber, $startsOn, $endsOn, $clientId): array {
            $existant = LeaseInsuranceSubmission::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('client_id', $clientId)->first();

            if ($existant !== null) {
                return $this->rejouer($existant, $insurer, $policyNumber, $startsOn, $endsOn);
            }

            if (! $position->active) {
                throw ErrorCode::InsuranceSubmissionNotAllowed->problem();
            }

            if ($endsOn->lessThanOrEqualTo($startsOn) || $endsOn->lessThan(CarbonImmutable::today())) {
                throw ErrorCode::InsurancePeriodInvalid->problem();
            }

            try {
                $depot = DB::transaction(function () use ($position, $user, $source, $nomFichier, $insurer, $policyNumber, $startsOn, $endsOn, $clientId): LeaseInsuranceSubmission {
                    if (LeaseInsuranceSubmission::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('status', InsuranceSubmissionStatus::Pending->value)->exists()) {
                        throw ErrorCode::InsuranceSubmissionNotAllowed->problem('Un dépôt est déjà en attente de traitement pour ce bail : retirez-le avant d\'en déposer un autre.');
                    }

                    $fichier = $this->fichiers->store($source, $nomFichier, FileCategory::Certificate, DocumentSubject::tenantSpace($position->leaseId));

                    $depot = LeaseInsuranceSubmission::query()->create([
                        'lease_id' => $position->leaseId,
                        'party_id' => $position->partyId,
                        'stored_file_id' => $fichier->id,
                        'insurer' => $insurer,
                        'policy_number' => $policyNumber,
                        'starts_on' => $startsOn,
                        'ends_on' => $endsOn,
                        'client_id' => $clientId,
                        'status' => InsuranceSubmissionStatus::Pending,
                    ]);
                    $this->audit->handle('leases.insurance.submitted', $user->id, [], $depot);

                    return $depot;
                });
            } catch (UniqueConstraintViolationException $erreur) {
                $existant = LeaseInsuranceSubmission::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('client_id', $clientId)->first();

                if ($existant === null) {
                    throw ErrorCode::InsuranceSubmissionNotAllowed->problem('Un dépôt est déjà en attente de traitement pour ce bail : retirez-le avant d\'en déposer un autre.');
                }

                return $this->rejouer($existant, $insurer, $policyNumber, $startsOn, $endsOn);
            }

            LeaseInsuranceSubmitted::dispatch($depot->id, $position->leaseId, $position->organizationId);

            return ['submission' => $depot, 'replayed' => false];
        });
    }

    /**
     * @return array{submission: LeaseInsuranceSubmission, replayed: bool}
     */
    private function rejouer(LeaseInsuranceSubmission $existant, string $insurer, string $policyNumber, CarbonImmutable $startsOn, CarbonImmutable $endsOn): array
    {
        $memes = $existant->insurer === $insurer && $existant->policy_number === $policyNumber
            && $existant->starts_on->toDateString() === $startsOn->toDateString() && $existant->ends_on->toDateString() === $endsOn->toDateString();

        if (! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['submission' => $existant, 'replayed' => true];
    }
}
