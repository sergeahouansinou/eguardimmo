<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Mandates\Data\AmendMandateTermsData;
use App\Modules\Mandates\Data\NewMandateTermData;
use App\Modules\Mandates\Enums\DocumentUploader;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Modules\Mandates\Events\MandateDocumentShared;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Support\DraftMandateStructure;
use App\Modules\Mandates\Support\MandateAuthor;
use App\Modules\Mandates\Support\MandateFileGuard;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AmendMandateTerms
{
    public function __construct(
        private Mandates $mandats,
        private DraftMandateStructure $structure,
        private MandateFileGuard $fichiers,
        private MandateAuthor $auteur,
        private RecordAudit $audit,
    ) {}

    /**
     * Avenant financier : ferme les conditions en cours au jour de prise d'effet et en ouvre de nouvelles. Seules les
     * conditions ouvertes se modifient, jamais l'historique ; un avenant de durée passe par le renouvellement. La pièce
     * signée du mandant est exigée, utilisable une seule fois, et partagée d'office avec lui.
     */
    public function handle(Mandate $mandate, AmendMandateTermsData $donnees): MandateTerm
    {
        return DB::transaction(function () use ($mandate, $donnees): MandateTerm {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if (! in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true)) {
                throw ErrorCode::MandateNotRunning->problem();
            }

            if ($donnees->effectiveOn < CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Un avenant ne prend pas effet dans le passé.');
            }

            if ($donnees->effectiveOn >= $mandat->ends_on->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Un avenant prend effet avant la fin du mandat.');
            }

            $courantes = MandateTerm::query()->where('mandate_id', $mandat->id)->whereNull('valid_to')->lockForUpdate()->first()
                ?? throw ErrorCode::MandateTermConflict->problem();

            if ($donnees->effectiveOn <= $courantes->valid_from->toDateString()) {
                throw ErrorCode::MandateTermConflict->problem();
            }

            $this->assertSignedFile($mandat, $donnees->signedFileId);

            $nouvelles = $this->merge($courantes, $donnees);
            $courantes->setAttribute('valid_to', $donnees->effectiveOn);
            $courantes->save();

            $terme = $this->structure->writeTerm($mandat, $nouvelles, $donnees->effectiveOn, TermChangeReason::Amendment, $courantes->id);

            $piece = MandateDocument::query()->create([
                'mandate_id' => $mandat->id,
                'stored_file_id' => (string) $donnees->signedFileId,
                'kind' => MandateDocumentKind::Amendment,
                'uploaded_by_kind' => DocumentUploader::Agency,
                'shared_by_user_id' => $this->auteur->id(),
                'shared_at' => now(),
            ]);

            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            MandateDocumentShared::dispatch($piece->id, $mandat->id, $mandat->organization_id, $mandat->mandant_party_id);

            $this->audit->handle('mandates.terms.amended', subject: $terme, metadata: [
                'mandate_id' => $mandat->id,
                'effective_on' => $donnees->effectiveOn,
                'signed_file_id' => $donnees->signedFileId,
                'document_id' => $piece->id,
            ]);

            return $terme;
        });
    }

    private function assertSignedFile(Mandate $mandat, ?string $fichierId): void
    {
        if ($fichierId === null) {
            throw ErrorCode::MandateAmendmentSignatureRequired->problem();
        }

        $this->fichiers->assertDepositedFor($mandat, $fichierId, [FileCategory::Supporting], ErrorCode::MandateAmendmentSignatureRequired);

        if (MandateTerm::query()->where('signed_file_id', $fichierId)->exists()) {
            throw ErrorCode::MandateAmendmentSignatureRequired->problem('Cette pièce signée accompagne déjà un autre avenant : chaque avenant a la sienne.');
        }
    }

    private function merge(MandateTerm $courantes, AmendMandateTermsData $donnees): NewMandateTermData
    {
        $genre = $donnees->feeKind ?? $courantes->fee_kind;
        $memeGenre = $genre === $courantes->fee_kind;
        $forfait = $donnees->feeFlatAmount ?? ($memeGenre ? $courantes->fee_flat_amount?->getAmount() : null);

        return new NewMandateTermData(
            feeKind: $genre,
            feeBasisPoints: $donnees->feeBasisPoints ?? ($memeGenre ? $courantes->fee_basis_points : null),
            feeFlatAmount: $forfait === null ? null : (int) $forfait,
            payoutDay: $donnees->payoutDay ?? $courantes->payout_day,
            worksLimitAmount: $donnees->worksLimitAmount ?? (int) $courantes->works_limit_amount->getAmount(),
            feeBase: $donnees->feeBase ?? $courantes->fee_base,
            feeMinimumAmount: $donnees->feeMinimumAmount ?? (int) $courantes->fee_minimum_amount->getAmount(),
            feeTaxMode: $donnees->feeTaxMode ?? $courantes->fee_tax_mode,
            lettingFeeBasisPoints: $donnees->lettingFeeChanged ? $donnees->lettingFeeBasisPoints : $courantes->letting_fee_basis_points,
            worksFeeBasisPoints: $donnees->worksFeeChanged ? $donnees->worksFeeBasisPoints : $courantes->works_fee_basis_points,
            signedFileId: $donnees->signedFileId,
        );
    }
}
