<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case InterventionNotFound = 'intervention_not_found';
    case OwnerInterventionNotFound = 'owner_intervention_not_found';
    case OwnerFileNotFound = 'owner_intervention_file_not_found';
    case LeaseNotFound = 'intervention_lease_not_found';
    case VisitNotFound = 'intervention_visit_not_found';
    case QuoteNotFound = 'intervention_quote_not_found';
    case ApprovalNotFound = 'intervention_approval_not_found';
    case InvoiceNotFound = 'supplier_invoice_not_found';
    case AllocationNotFound = 'invoice_allocation_not_found';
    case PaymentNotFound = 'supplier_payment_not_found';
    case SupplierNotFound = 'supplier_not_found';
    case FileNotFound = 'intervention_file_not_found';
    case StaleVersion = 'intervention_stale_version';
    case TransitionInvalid = 'intervention_transition_invalid';
    case IdempotencyKeyReused = 'maintenance_idempotency_key_reused';
    case ApprovalAlreadyDecided = 'approval_already_decided';
    case ApprovalAlreadyPending = 'approval_already_pending';
    case SupplierInvoiceDuplicate = 'supplier_invoice_duplicate';
    case QuoteFrozen = 'quote_frozen';
    case QuoteStatusInvalid = 'quote_status_invalid';
    case VisitStatusInvalid = 'visit_status_invalid';
    case InvoiceStatusInvalid = 'supplier_invoice_status_invalid';
    case CloseBlocked = 'intervention_close_blocked';
    case ReopenBlocked = 'intervention_reopen_blocked';
    case SupplierStatusInvalid = 'supplier_status_invalid';
    case LeaseNotActive = 'intervention_lease_not_active';
    case TooManyOpen = 'intervention_too_many_open';
    case UnitInvalid = 'intervention_unit_invalid';
    case NoMandate = 'intervention_no_mandate';
    case MandateSuspended = 'intervention_mandate_suspended';
    case QualificationIncomplete = 'intervention_qualification_incomplete';
    case ApprovalRequired = 'intervention_approval_required';
    case ApprovalProofRequired = 'approval_proof_required';
    case EmergencyNotAllowed = 'intervention_emergency_not_allowed';
    case FilesLimit = 'intervention_files_limit';
    case FileInvalid = 'intervention_file_invalid';
    case SupplierInsuranceMissing = 'supplier_insurance_missing';
    case SupplierUnavailable = 'supplier_unavailable';
    case SupplierRequired = 'intervention_supplier_required';
    case QuoteTotalMismatch = 'quote_total_mismatch';
    case QuoteLinesInvalid = 'quote_lines_invalid';
    case TaxRateUnknown = 'maintenance_tax_rate_unknown';
    case CurrencyMismatch = 'maintenance_currency_mismatch';
    case InvoiceTotalsInvalid = 'supplier_invoice_totals_invalid';
    case InvoiceExceedsApproval = 'supplier_invoice_exceeds_approval';
    case InvoiceNotAllocable = 'supplier_invoice_not_allocable';
    case AllocationExceedsInvoice = 'allocation_exceeds_invoice';
    case AllocationDepositUnavailable = 'allocation_deposit_unavailable';
    case AllocationNotChargeable = 'allocation_not_chargeable';
    case PaymentExceedsOutstanding = 'payment_exceeds_outstanding';
    case PaymentInvalid = 'supplier_payment_invalid';
    case OwnerFundsInsufficient = 'owner_funds_insufficient';
    case PaymentEngagementRequired = 'supplier_payment_engagement_required';
    case TrustFundsGap = 'trust_funds_gap';
    case PaymentSecondApproverRequired = 'supplier_payment_second_approver_required';
    case JurisdictionUnsupported = 'maintenance_jurisdiction_unsupported';
    case IdempotencyKeyRequired = 'idempotency_key_required';
    case ApprovalStale = 'approval_stale';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->title().'.');
    }

    public function status(): int
    {
        return match ($this) {
            self::InterventionNotFound, self::LeaseNotFound, self::VisitNotFound, self::QuoteNotFound, self::ApprovalNotFound, self::InvoiceNotFound, self::AllocationNotFound, self::PaymentNotFound, self::SupplierNotFound, self::FileNotFound, self::OwnerInterventionNotFound, self::OwnerFileNotFound => 404,
            self::StaleVersion, self::TransitionInvalid, self::IdempotencyKeyReused, self::ApprovalAlreadyDecided, self::ApprovalAlreadyPending, self::ApprovalStale, self::SupplierInvoiceDuplicate, self::QuoteFrozen, self::QuoteStatusInvalid, self::VisitStatusInvalid, self::InvoiceStatusInvalid, self::CloseBlocked, self::ReopenBlocked, self::SupplierStatusInvalid, self::OwnerFundsInsufficient, self::PaymentEngagementRequired, self::TrustFundsGap => 409,
            self::PaymentSecondApproverRequired => 403,
            self::LeaseNotActive, self::TooManyOpen, self::UnitInvalid, self::NoMandate, self::MandateSuspended, self::QualificationIncomplete, self::ApprovalRequired, self::ApprovalProofRequired, self::EmergencyNotAllowed, self::FilesLimit, self::FileInvalid, self::SupplierInsuranceMissing, self::SupplierUnavailable, self::SupplierRequired, self::QuoteTotalMismatch, self::QuoteLinesInvalid, self::TaxRateUnknown, self::CurrencyMismatch, self::InvoiceTotalsInvalid, self::InvoiceExceedsApproval, self::InvoiceNotAllocable, self::AllocationExceedsInvoice, self::AllocationDepositUnavailable, self::AllocationNotChargeable, self::PaymentExceedsOutstanding, self::PaymentInvalid, self::JurisdictionUnsupported, self::IdempotencyKeyRequired => 422,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::InterventionNotFound, self::OwnerInterventionNotFound => 'Intervention introuvable',
            self::LeaseNotFound => 'Bail introuvable',
            self::VisitNotFound => 'Visite introuvable',
            self::QuoteNotFound => 'Devis introuvable',
            self::ApprovalNotFound => 'Demande d\'accord introuvable',
            self::InvoiceNotFound => 'Facture reçue introuvable',
            self::AllocationNotFound => 'Imputation introuvable',
            self::PaymentNotFound => 'Règlement introuvable',
            self::SupplierNotFound => 'Prestataire introuvable',
            self::FileNotFound, self::OwnerFileNotFound => 'Fichier introuvable',
            self::StaleVersion => 'Intervention modifiée entre-temps',
            self::TransitionInvalid => 'Transition d\'état interdite',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::ApprovalAlreadyDecided => 'Demande d\'accord déjà tranchée',
            self::ApprovalAlreadyPending => 'Une demande d\'accord est déjà ouverte',
            self::SupplierInvoiceDuplicate => 'Facture déjà enregistrée',
            self::QuoteFrozen => 'Devis figé',
            self::QuoteStatusInvalid => 'État du devis incompatible',
            self::VisitStatusInvalid => 'État de la visite incompatible',
            self::InvoiceStatusInvalid => 'État de la facture incompatible',
            self::CloseBlocked => 'Clôture impossible',
            self::ReopenBlocked => 'Réouverture impossible',
            self::SupplierStatusInvalid => 'État du prestataire incompatible',
            self::LeaseNotActive => 'Bail non actif',
            self::TooManyOpen => 'Trop de demandes ouvertes sur ce bail',
            self::UnitInvalid => 'Lot étranger au bail',
            self::NoMandate => 'Aucun mandat ne couvre ce lot',
            self::MandateSuspended => 'Mandat suspendu',
            self::QualificationIncomplete => 'Qualification incomplète',
            self::ApprovalRequired => 'Accord du mandant requis',
            self::ApprovalProofRequired => 'Pièce écrite du mandant requise',
            self::EmergencyNotAllowed => 'Engagement en urgence refusé',
            self::FilesLimit => 'Trop de fichiers sur cette intervention',
            self::FileInvalid => 'Fichier incompatible avec cet usage',
            self::SupplierInsuranceMissing => 'Assurance du prestataire manquante',
            self::SupplierUnavailable => 'Prestataire indisponible',
            self::SupplierRequired => 'Prestataire à désigner',
            self::QuoteTotalMismatch => 'Total du devis différent du PDF',
            self::QuoteLinesInvalid => 'Lignes de devis invalides',
            self::TaxRateUnknown => 'Taux de taxe inconnu à cette date',
            self::CurrencyMismatch => 'Devise incohérente',
            self::InvoiceTotalsInvalid => 'Montants de la facture incohérents',
            self::InvoiceExceedsApproval => 'Facture au-dessus du montant engagé',
            self::InvoiceNotAllocable => 'Facture non imputable',
            self::AllocationExceedsInvoice => 'Imputation supérieure au reste à imputer',
            self::AllocationDepositUnavailable => 'Dépôt de garantie indisponible',
            self::AllocationNotChargeable => 'Imputation au locataire refusée',
            self::PaymentExceedsOutstanding => 'Règlement supérieur au reste dû',
            self::PaymentInvalid => 'Règlement invalide',
            self::OwnerFundsInsufficient => 'Solde du mandant insuffisant',
            self::PaymentEngagementRequired => 'Engagement requis avant tout règlement sur fonds de tiers',
            self::TrustFundsGap => 'Écart de cantonnement',
            self::PaymentSecondApproverRequired => 'Second validateur requis',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence obligatoire',
            self::ApprovalStale => 'La demande a changé depuis son affichage',
        };
    }
}
