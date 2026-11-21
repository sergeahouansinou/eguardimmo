<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case LoanNotFound = 'loan_not_found';
    case AcquisitionNotFound = 'acquisition_not_found';
    case LandlordOnly = 'investments_landlord_only';
    case IdempotencyKeyRequired = 'investments_idempotency_key_required';
    case LoanTermsInvalid = 'loan_terms_invalid';
    case LoanScheduleInconsistent = 'loan_schedule_inconsistent';
    case AcquisitionScopeMixed = 'acquisition_scope_mixed';
    case TargetInvalid = 'investments_target_invalid';
    case FileInvalid = 'investments_file_invalid';
    case LoanInUse = 'loan_in_use';
    case LoanVersionConflict = 'loan_version_conflict';
    case LoanStateInvalid = 'loan_state_invalid';
    case AcquisitionExists = 'acquisition_exists';
    case AttestationExists = 'loan_attestation_exists';
    case IdempotencyKeyReused = 'investments_idempotency_key_reused';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->title());
    }

    public function status(): int
    {
        return match ($this) {
            self::LoanNotFound, self::AcquisitionNotFound => 404,
            self::LandlordOnly => 403,
            self::IdempotencyKeyRequired, self::LoanTermsInvalid, self::LoanScheduleInconsistent, self::AcquisitionScopeMixed, self::TargetInvalid, self::FileInvalid => 422,
            self::LoanInUse, self::AcquisitionExists, self::LoanVersionConflict, self::LoanStateInvalid, self::AttestationExists, self::IdempotencyKeyReused => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::LoanNotFound => 'Prêt introuvable',
            self::AcquisitionNotFound => 'Coût de revient introuvable',
            self::LandlordOnly => 'Réservé aux bailleurs autonomes',
            self::IdempotencyKeyRequired => 'En-tête Idempotency-Key obligatoire',
            self::LoanTermsInvalid => 'Conditions du prêt invalides',
            self::LoanScheduleInconsistent => 'Tableau d\'amortissement incohérent',
            self::AcquisitionScopeMixed => 'Un bien se renseigne en entier ou lot par lot, pas les deux',
            self::TargetInvalid => 'Bien ou lot invalide',
            self::FileInvalid => 'Pièce invalide',
            self::LoanInUse => 'Prêt utilisé par une synthèse fiscale figée',
            self::LoanVersionConflict => 'Le prêt a été modifié entre-temps',
            self::LoanStateInvalid => 'Cette opération n\'est pas possible dans l\'état du prêt',
            self::AcquisitionExists => 'Le coût de revient de ce bien ou lot existe déjà',
            self::AttestationExists => 'Une attestation existe déjà pour cette année',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée avec un autre contenu',
        };
    }
}
