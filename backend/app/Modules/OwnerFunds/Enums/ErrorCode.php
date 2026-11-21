<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case BatchNotFound = 'payout_batch_not_found';
    case ItemNotFound = 'payout_item_not_found';
    case HoldNotFound = 'payout_hold_not_found';
    case MandantNotFound = 'owner_funds_mandant_not_found';
    case MandateNotFound = 'owner_funds_mandate_not_found';
    case DepositNotFound = 'trust_deposit_not_found';
    case DepositNotActionable = 'trust_deposit_not_actionable';
    case StaleVersion = 'payout_stale_version';
    case NotValidatable = 'payout_not_validatable';
    case ItemExcluded = 'payout_item_excluded';
    case SecondApproverRequired = 'payout_second_approver_required';
    case CancelForbidden = 'payout_cancel_forbidden';
    case ItemNotActionable = 'payout_item_not_actionable';
    case AccountChanged = 'payout_account_changed';
    case AgencyOnly = 'owner_funds_agency_only';
    case IdempotencyKeyRequired = 'owner_funds_idempotency_key_required';
    case IdempotencyKeyReused = 'owner_funds_idempotency_key_reused';
    case Insufficient = 'owner_funds_insufficient';
    case FeeBaseMissing = 'fee_base_missing';
    case PeriodNotClosed = 'period_not_closed';
    case TrustFundsGap = 'trust_funds_gap';
    case TrustWithdrawalExceedsSurplus = 'trust_withdrawal_exceeds_surplus';
    case JurisdictionUnsupported = 'owner_funds_jurisdiction_unsupported';
    case NothingToPay = 'payout_nothing_to_pay';
    case OwnerAccessNotFound = 'owner_access_not_found';
    case RequestNotFound = 'payout_account_request_not_found';
    case RequestPending = 'payout_account_request_pending';
    case RequestNotActionable = 'payout_account_request_not_actionable';
    case RequestStale = 'payout_account_request_stale';
    case CodeInvalid = 'payout_account_code_invalid';
    case IbanInvalid = 'payout_account_iban_invalid';
    case IbanMismatch = 'payout_account_iban_mismatch';
    case Unchanged = 'payout_account_unchanged';
    case HolderMismatch = 'payout_account_holder_mismatch';
    case SelfApproval = 'payout_account_self_approval';
    case Contested = 'payout_account_contested';
    case AccessRevoked = 'payout_account_access_revoked';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::BatchNotFound, self::ItemNotFound, self::HoldNotFound, self::MandantNotFound, self::MandateNotFound, self::DepositNotFound, self::OwnerAccessNotFound, self::RequestNotFound => 404,
            self::AgencyOnly, self::SecondApproverRequired => 403,
            self::IdempotencyKeyRequired, self::FeeBaseMissing, self::JurisdictionUnsupported,
            self::CodeInvalid, self::IbanInvalid, self::IbanMismatch, self::Unchanged, self::HolderMismatch => 422,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::BatchNotFound => 'Lot de reversements introuvable',
            self::ItemNotFound => 'Reversement introuvable',
            self::HoldNotFound => 'Retenue introuvable',
            self::MandantNotFound => 'Mandant introuvable',
            self::MandateNotFound => 'Mandat introuvable',
            self::DepositNotFound => 'Apport introuvable',
            self::DepositNotActionable => 'Apport déjà confirmé',
            self::StaleVersion => 'Lot modifié entre-temps',
            self::NotValidatable => 'Lot non validable',
            self::ItemExcluded => 'Reversement exclu',
            self::SecondApproverRequired => 'Second validateur requis',
            self::CancelForbidden => 'Annulation impossible',
            self::ItemNotActionable => 'Action impossible sur ce reversement',
            self::AccountChanged => 'Compte de paiement modifié',
            self::AgencyOnly => 'Fonction réservée aux agences',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence requise',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::Insufficient => 'Fonds du mandant insuffisants',
            self::FeeBaseMissing => 'Base des honoraires non renseignée',
            self::PeriodNotClosed => 'Mois non clos',
            self::TrustFundsGap => 'Écart de cantonnement',
            self::TrustWithdrawalExceedsSurplus => 'Prélèvement supérieur à l\'excédent',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::NothingToPay => 'Rien à reverser',
            self::OwnerAccessNotFound => 'Accès propriétaire introuvable',
            self::RequestNotFound => 'Demande de compte de paiement introuvable',
            self::RequestPending => 'Une demande est déjà en cours',
            self::RequestNotActionable => 'Action impossible sur cette demande',
            self::RequestStale => 'Demande modifiée entre-temps',
            self::CodeInvalid => 'Code de confirmation invalide',
            self::IbanInvalid => 'IBAN invalide',
            self::IbanMismatch => 'IBAN différent de la demande',
            self::Unchanged => 'Compte de paiement inchangé',
            self::HolderMismatch => 'Titulaire différent de la demande',
            self::SelfApproval => 'Validation par le demandeur interdite',
            self::Contested => 'Changement de compte contesté',
            self::AccessRevoked => 'Accès du demandeur révoqué',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::BatchNotFound => 'Ce lot n\'existe pas dans votre organisation.',
            self::ItemNotFound => 'Ce reversement n\'existe pas dans votre organisation.',
            self::HoldNotFound => 'Cette retenue n\'existe pas dans votre organisation.',
            self::MandantNotFound => 'Ce mandant n\'existe pas dans votre organisation.',
            self::MandateNotFound => 'Ce mandat n\'existe pas dans votre organisation ou est encore un brouillon.',
            self::DepositNotFound => 'Cet apport n\'existe pas dans votre organisation.',
            self::DepositNotActionable => 'Cet apport a déjà été confirmé.',
            self::StaleVersion => 'Ce lot a été modifié depuis votre lecture : rechargez-le.',
            self::NotValidatable => 'Seul un lot brouillon comportant au moins un mandant inclus peut être validé.',
            self::ItemExcluded => 'Ce mandant est exclu pour un motif qui ne se lève pas à la main.',
            self::SecondApproverRequired => 'Le reversement doit être exécuté par une autre personne que celle qui l\'a validé.',
            self::CancelForbidden => 'Un lot dont un virement est exécuté ne s\'annule pas : déclarez un retour bancaire.',
            self::ItemNotActionable => 'L\'état de ce reversement ne permet pas cette action.',
            self::AccountChanged => 'Le compte de paiement du mandant a changé depuis la validation du lot : vérifiez-le puis reconnaissez le changement pour exécuter.',
            self::AgencyOnly => 'Les fonds des mandants sont réservés aux organisations de type agence.',
            self::IdempotencyKeyRequired => 'L\'en-tête Idempotency-Key est obligatoire pour cette action.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour une demande différente.',
            self::Insufficient => 'Le solde du mandant ne couvre pas ce règlement : saisissez une avance sur fonds propres.',
            self::FeeBaseMissing => 'Le barème du mandat n\'indique pas la base des honoraires : passez un avenant.',
            self::PeriodNotClosed => 'Les honoraires ne se calculent que sur un mois clos.',
            self::TrustFundsGap => 'Les fonds du compte de tiers ne couvrent pas ce que l\'agence doit aux mandants et aux locataires.',
            self::TrustWithdrawalExceedsSurplus => 'Le prélèvement dépasse l\'excédent du compte de tiers.',
            self::JurisdictionUnsupported => 'La juridiction du siège n\'a pas encore de règles pour les fonds des mandants.',
            self::NothingToPay => 'Le net reversable de ce mandant est nul.',
            self::OwnerAccessNotFound => 'Cet accès n\'existe pas ou ne vous appartient pas.',
            self::RequestNotFound => 'Cette demande n\'existe pas.',
            self::RequestPending => 'Une demande de changement de compte de paiement est déjà en cours pour ce mandant.',
            self::RequestNotActionable => 'L\'état de cette demande ne permet pas cette action.',
            self::RequestStale => 'Cette demande a changé depuis votre lecture : rechargez-la.',
            self::CodeInvalid => 'Le code est incorrect, expiré ou le nombre d\'essais est épuisé : refaites une demande.',
            self::IbanInvalid => 'Cet IBAN n\'est pas valide ou son pays n\'est pas admis.',
            self::IbanMismatch => 'L\'IBAN saisi ne correspond pas à celui de la demande.',
            self::Unchanged => 'Ce compte est déjà le compte de paiement actuel.',
            self::HolderMismatch => 'Le titulaire saisi ne correspond pas à celui de la demande.',
            self::SelfApproval => 'Un compte qui détient un accès à ce mandant ne peut pas valider sa propre demande de changement de compte : confiez-la à un autre membre de l\'équipe.',
            self::Contested => 'Le mandant a contesté un changement de compte : tant que la retenue n\'est pas levée par l\'agence, aucune nouvelle demande n\'est acceptée.',
            self::AccessRevoked => 'L\'accès du demandeur a été révoqué : la demande est abandonnée.',
        };
    }
}
