<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case ExpenseNotFound = 'expense_not_found';
    case KeyNotFound = 'charge_key_not_found';
    case ExerciseNotFound = 'charge_exercise_not_found';
    case StatementNotFound = 'charge_statement_not_found';
    case FileNotFound = 'charges_file_not_found';
    case AgencyOnly = 'charges_agency_only';
    case RoleForbidden = 'charges_role_forbidden';
    case TwoFactorRequired = 'charges_two_factor_required';
    case IdempotencyKeyRequired = 'charges_idempotency_key_required';
    case ExpenseSettlementInvalid = 'expense_settlement_invalid';
    case ExpenseSplitRequired = 'expense_split_required';
    case ExpenseInvalid = 'expense_invalid';
    case FileInvalid = 'charges_file_invalid';
    case KeyIncomplete = 'charge_key_incomplete';
    case KeyChangedDuringPeriod = 'charge_key_changed_during_period';
    case KeyInvalid = 'charge_key_invalid';
    case ExercisePeriodInvalid = 'charge_exercise_period_invalid';
    case ItemInvalid = 'charge_item_invalid';
    case JurisdictionUnsupported = 'charges_jurisdiction_unsupported';
    case RegimeUnsupported = 'charges_regime_unsupported';
    case PrescriptionAckRequired = 'charges_prescription_ack_required';
    case PlanInvalid = 'charges_plan_invalid';
    case RectificationInvalid = 'charges_rectification_invalid';
    case PdfUnavailable = 'charges_pdf_unavailable';
    case ExpenseDuplicate = 'expense_duplicate';
    case ExpenseInUse = 'expense_in_use';
    case ExpenseNotCancellable = 'expense_not_cancellable';
    case OwnerFundsInsufficient = 'owner_funds_insufficient';
    case TrustFundsGap = 'trust_funds_gap';
    case SecondApproverRequired = 'charges_second_approver_required';
    case SourceExhausted = 'charge_source_exhausted';
    case ExerciseOverlap = 'charge_exercise_overlap';
    case ExerciseStateInvalid = 'charge_exercise_state_invalid';
    case StatementStateInvalid = 'charge_statement_state_invalid';
    case KeyArchived = 'charge_key_archived';
    case OwnerFundsNotReady = 'charges_owner_funds_not_ready';
    case IdempotencyKeyReused = 'charges_idempotency_key_reused';
    case StaleVersion = 'charges_stale_version';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(?string $detail = null): ApiProblem
    {
        $entetes = $this === self::PdfUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->title(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::ExpenseNotFound, self::KeyNotFound, self::ExerciseNotFound, self::StatementNotFound, self::FileNotFound => 404,
            self::AgencyOnly, self::RoleForbidden, self::TwoFactorRequired => 403,
            self::IdempotencyKeyRequired, self::ExpenseSettlementInvalid, self::ExpenseSplitRequired, self::ExpenseInvalid, self::FileInvalid, self::KeyIncomplete, self::KeyChangedDuringPeriod, self::KeyInvalid, self::ExercisePeriodInvalid, self::ItemInvalid, self::JurisdictionUnsupported, self::RegimeUnsupported, self::PrescriptionAckRequired, self::PlanInvalid, self::RectificationInvalid => 422,
            self::PdfUnavailable => 503,
            self::ExpenseDuplicate, self::ExpenseInUse, self::ExpenseNotCancellable, self::OwnerFundsInsufficient, self::TrustFundsGap, self::SecondApproverRequired, self::SourceExhausted, self::ExerciseOverlap, self::ExerciseStateInvalid, self::StatementStateInvalid, self::KeyArchived, self::OwnerFundsNotReady, self::IdempotencyKeyReused, self::StaleVersion => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::ExpenseNotFound => 'Dépense introuvable',
            self::KeyNotFound => 'Clé de répartition introuvable',
            self::ExerciseNotFound => 'Exercice introuvable',
            self::StatementNotFound => 'Décompte introuvable',
            self::FileNotFound => 'Pièce introuvable',
            self::AgencyOnly => 'Réservé aux agences',
            self::RoleForbidden => 'Droit insuffisant',
            self::TwoFactorRequired => 'Double authentification requise',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence obligatoire',
            self::ExpenseSettlementInvalid => 'Mode de règlement invalide',
            self::ExpenseSplitRequired => 'Une pièce par mandant est nécessaire',
            self::ExpenseInvalid => 'Dépense invalide',
            self::FileInvalid => 'Pièce invalide',
            self::KeyIncomplete => 'Clé de répartition incomplète',
            self::KeyChangedDuringPeriod => 'Clé modifiée pendant l\'exercice',
            self::KeyInvalid => 'Clé de répartition invalide',
            self::ExercisePeriodInvalid => 'Période d\'exercice invalide',
            self::ItemInvalid => 'Poste invalide',
            self::JurisdictionUnsupported => 'Juridiction non ouverte à la régularisation',
            self::RegimeUnsupported => 'Régime de bail non pris en charge',
            self::PrescriptionAckRequired => 'Prescription à reconnaître',
            self::PlanInvalid => 'Paiement par douzièmes impossible',
            self::RectificationInvalid => 'Rectificatif impossible',
            self::PdfUnavailable => 'PDF indisponible',
            self::ExpenseDuplicate => 'Dépense déjà enregistrée',
            self::ExpenseInUse => 'Dépense incluse dans un exercice',
            self::ExpenseNotCancellable => 'Dépense non annulable',
            self::OwnerFundsInsufficient => 'Solde du mandant insuffisant',
            self::TrustFundsGap => 'Compte de tiers non couvert',
            self::SecondApproverRequired => 'Seconde validation nécessaire',
            self::SourceExhausted => 'Source épuisée',
            self::ExerciseOverlap => 'Exercice chevauchant',
            self::ExerciseStateInvalid => 'État d\'exercice incompatible',
            self::StatementStateInvalid => 'État de décompte incompatible',
            self::KeyArchived => 'Clé archivée',
            self::OwnerFundsNotReady => 'Fonds des mandants non rattrapés',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
            self::StaleVersion => 'Version périmée',
        };
    }
}
