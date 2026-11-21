<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\NewNoticeRequestData;
use App\Modules\Leases\Data\NoticeReason;
use App\Modules\Leases\Data\ProofContext;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Events\NoticeRequested;
use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Support\NoticeJournal;
use App\Modules\Leases\Support\NoticeLetters;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class SubmitNoticeRequest
{
    public function __construct(
        private LeaseRegimes $regimes,
        private DocumentStore $fichiers,
        private IssuedDocuments $documents,
        private NoticeLetters $lettres,
        private NoticeJournal $journal,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Crée la demande, la lettre (PDF figé, empreinte) et le journal dans une seule transaction : si la lettre ne peut pas être
     * produite, rien n'est écrit. Le bail n'est jamais modifié. Rejouable par `client_id`.
     *
     * @return array{request: LeaseNoticeRequest, replayed: bool}
     */
    public function handle(TenantStandingData $position, User $user, NewNoticeRequestData $data, ProofContext $contexte): array
    {
        return $this->contexte->run($position->organizationId, function () use ($position, $user, $data, $contexte): array {
            $existante = LeaseNoticeRequest::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('client_id', $data->clientId)->first();

            if ($existante !== null) {
                return $this->rejouer($existante, $data);
            }

            $bail = Lease::query()->findOrFail($position->leaseId);
            $this->assertAllowed($position, $bail);
            [$regime, $motif] = $this->regimeAndReason($bail, $data->reasonKey);
            $aujourdhui = CarbonImmutable::today();
            $premier = $regime->tenantEarliestDeparture($bail->jurisdiction_data, $aujourdhui, $motif->key);

            if ($data->requestedDepartureOn->lessThan($premier)) {
                throw ErrorCode::NoticeDepartureTooEarly->problem('La date de départ souhaitée précède la fin du préavis ('.$premier->toDateString().').');
            }

            if ($motif->proofRequired && $data->proof === null) {
                throw ErrorCode::NoticeProofRequired->problem();
            }

            try {
                $demande = DB::transaction(fn (): LeaseNoticeRequest => $this->create($position, $user, $data, $contexte, $bail, $motif, $premier, $aujourdhui));
            } catch (UniqueConstraintViolationException $erreur) {
                $existante = LeaseNoticeRequest::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('client_id', $data->clientId)->first();

                if ($existante === null) {
                    throw ErrorCode::NoticeRequestExists->problem();
                }

                return $this->rejouer($existante, $data);
            }

            NoticeRequested::dispatch($demande->id, $demande->lease_id, $demande->organization_id);

            return ['request' => $demande, 'replayed' => false];
        });
    }

    private function assertAllowed(TenantStandingData $position, Lease $bail): void
    {
        if (! $position->active || $bail->status !== LeaseStatus::Signed || $bail->archived_at !== null || $bail->notice_received_on !== null) {
            throw ErrorCode::LeaseNoticeNotAllowed->problem();
        }

        if (LeaseNoticeRequest::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->whereIn('status', [NoticeRequestStatus::Submitted->value, NoticeRequestStatus::Acknowledged->value])->exists()) {
            throw ErrorCode::NoticeRequestExists->problem();
        }
    }

    /**
     * @return array{LeaseRegime, NoticeReason}
     */
    private function regimeAndReason(Lease $bail, string $cle): array
    {
        if (! $this->regimes->supports($bail->jurisdiction, $bail->regime_key)) {
            throw ErrorCode::LeaseJurisdictionUnsupported->problem();
        }

        $regime = $this->regimes->for($bail->jurisdiction, $bail->regime_key);

        foreach ($regime->tenantNoticeReasons($bail->jurisdiction_data) as $motif) {
            if ($motif->key === $cle) {
                return [$regime, $motif];
            }
        }

        throw ErrorCode::NoticeReasonUnsupported->problem();
    }

    private function create(TenantStandingData $position, User $user, NewNoticeRequestData $data, ProofContext $contexte, Lease $bail, NoticeReason $motif, CarbonImmutable $premier, CarbonImmutable $aujourdhui): LeaseNoticeRequest
    {
        $justificatif = $data->proof === null ? null : $this->fichiers->store($data->proof, (string) $data->proofName, FileCategory::Supporting, DocumentSubject::tenantSpace($position->leaseId));

        $demande = LeaseNoticeRequest::query()->create([
            'lease_id' => $position->leaseId,
            'party_id' => $position->partyId,
            'reason_key' => $motif->key,
            'requested_departure_on' => $data->requestedDepartureOn->toDateString(),
            'earliest_departure_on' => $premier->toDateString(),
            'proof_file_id' => $justificatif?->id,
            'forwarding_address' => $data->forwardingAddress,
            'consent_version' => $data->consentVersion,
            'client_id' => $data->clientId,
            'status' => NoticeRequestStatus::Submitted,
        ]);

        $instantane = $this->lettres->snapshot($demande, $bail, $motif, $aujourdhui);
        $pdf = $this->lettres->pdf($instantane);
        $lettre = $this->documents->issue(new NewIssuedDocumentData(
            IssuedDocumentType::Letter,
            $instantane,
            NoticeLetters::TEMPLATE_VERSION,
            FileSource::contents($pdf),
            'conge-'.$aujourdhui->toDateString().'.pdf',
            new DocumentSubject('lease', $bail->id),
        ));

        $demande->forceFill(['letter_document_id' => $lettre->id, 'letter_file_id' => $lettre->file->id, 'letter_fingerprint' => $lettre->fingerprint])->save();

        $this->journal->record($demande, NoticeRequestEventKind::Submitted, $user->id, $contexte, $data->consentVersion, ['proof_attached' => $justificatif !== null]);
        $this->journal->record($demande, NoticeRequestEventKind::LetterIssued, $user->id, $contexte, data: ['fingerprint' => $lettre->fingerprint]);
        $this->audit->handle('leases.notice_request.submitted', $user->id, [], $demande);

        return $demande;
    }

    /**
     * @return array{request: LeaseNoticeRequest, replayed: bool}
     */
    private function rejouer(LeaseNoticeRequest $existante, NewNoticeRequestData $data): array
    {
        $memes = $existante->reason_key === $data->reasonKey
            && $existante->requested_departure_on->toDateString() === $data->requestedDepartureOn->toDateString()
            && $existante->forwarding_address === $data->forwardingAddress;

        if (! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['request' => $existante, 'replayed' => true];
    }
}
