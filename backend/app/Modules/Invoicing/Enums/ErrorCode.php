<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case InvoiceNotFound = 'invoice_not_found';
    case OwnerInvoiceNotFound = 'owner_invoice_not_found';
    case PaymentNotFound = 'invoice_payment_not_found';
    case AgencyOnly = 'invoicing_agency_only';
    case JurisdictionUnsupported = 'invoice_jurisdiction_unsupported';
    case ItemForbiddenForTenant = 'invoice_item_forbidden_for_tenant';
    case StaleVersion = 'invoice_stale_version';
    case CreditExceedsOutstanding = 'invoice_credit_exceeds_outstanding';
    case CreditExceedsLine = 'invoice_credit_exceeds_line';
    case PaymentExceedsOutstanding = 'invoice_payment_exceeds_outstanding';
    case IdempotencyKeyReused = 'invoice_idempotency_key_reused';
    case IssuerIncomplete = 'invoice_issuer_incomplete';
    case RecipientIncomplete = 'invoice_recipient_incomplete';
    case RecipientEmailMissing = 'invoice_recipient_email_missing';
    case PdfUnavailable = 'invoice_pdf_unavailable';
    case EInvoicingRequired = 'invoice_einvoicing_required';
    case NotDraft = 'invoice_not_draft';
    case NotIssued = 'invoice_not_issued';
    case NotCreditable = 'invoice_not_creditable';
    case NotPayable = 'invoice_not_payable';
    case TaxRateUnknown = 'invoice_tax_rate_unknown';
    case TaxRateNotAllowed = 'invoice_tax_rate_not_allowed';
    case LinesInvalid = 'invoice_lines_invalid';
    case ReferencesInconsistent = 'invoice_references_inconsistent';
    case DueDateInvalid = 'invoice_due_date_invalid';
    case PaymentInvalid = 'invoice_payment_invalid';
    case FeeComputedByServer = 'invoice_fee_computed_by_server';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(?string $detail = null): ApiProblem
    {
        $entetes = $this === self::PdfUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::InvoiceNotFound, self::OwnerInvoiceNotFound, self::PaymentNotFound => 404,
            self::AgencyOnly => 403,
            self::JurisdictionUnsupported, self::ItemForbiddenForTenant, self::CreditExceedsOutstanding, self::CreditExceedsLine,
            self::PaymentExceedsOutstanding, self::IssuerIncomplete, self::RecipientIncomplete, self::RecipientEmailMissing,
            self::EInvoicingRequired, self::TaxRateUnknown, self::TaxRateNotAllowed, self::LinesInvalid, self::ReferencesInconsistent, self::DueDateInvalid, self::PaymentInvalid, self::FeeComputedByServer => 422,
            self::PdfUnavailable => 503,
            self::StaleVersion, self::IdempotencyKeyReused, self::NotDraft, self::NotIssued, self::NotCreditable, self::NotPayable => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::InvoiceNotFound, self::OwnerInvoiceNotFound => 'Facture introuvable',
            self::PaymentNotFound => 'Règlement introuvable',
            self::AgencyOnly => 'Fonction réservée aux agences',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::ItemForbiddenForTenant => 'Ligne interdite pour ce destinataire',
            self::StaleVersion => 'Brouillon modifié entre-temps',
            self::CreditExceedsOutstanding => 'Avoir supérieur au reste dû',
            self::CreditExceedsLine => 'Avoir supérieur à la ligne facturée',
            self::PaymentExceedsOutstanding => 'Règlement supérieur au reste dû',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::IssuerIncomplete => 'Identité légale de l\'émetteur incomplète',
            self::RecipientIncomplete => 'Coordonnées du destinataire incomplètes',
            self::RecipientEmailMissing => 'Destinataire sans adresse e-mail',
            self::PdfUnavailable => 'Service PDF indisponible',
            self::EInvoicingRequired => 'Facture électronique obligatoire',
            self::NotDraft => 'Facture déjà émise',
            self::NotIssued => 'Facture non émise',
            self::NotCreditable => 'Facture non créditable',
            self::NotPayable => 'Facture non réglable',
            self::TaxRateUnknown => 'Taux de taxe introuvable',
            self::TaxRateNotAllowed => 'Taux de taxe non autorisé',
            self::LinesInvalid => 'Lignes de facture invalides',
            self::ReferencesInconsistent => 'Références de facture incohérentes',
            self::DueDateInvalid => 'Échéance invalide',
            self::PaymentInvalid => 'Règlement invalide',
            self::FeeComputedByServer => 'Honoraires de gestion calculés par le serveur',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::InvoiceNotFound => 'Cette facture n\'existe pas dans votre organisation.',
            self::OwnerInvoiceNotFound => 'Cette facture n\'existe pas dans votre espace.',
            self::PaymentNotFound => 'Ce règlement n\'existe pas dans votre organisation.',
            self::AgencyOnly => 'La facturation est réservée aux organisations de type agence.',
            self::JurisdictionUnsupported => 'La juridiction du siège n\'a pas encore de règles de facturation.',
            self::ItemForbiddenForTenant => 'Les frais de relance ou de procédure ne se refacturent qu\'au mandant, jamais à un locataire d\'habitation.',
            self::StaleVersion => 'Ce brouillon a été modifié depuis votre lecture : rechargez-le avant de l\'enregistrer.',
            self::CreditExceedsOutstanding => 'Le cumul des avoirs ne peut pas dépasser le reste dû de la facture.',
            self::CreditExceedsLine => 'Le cumul des avoirs d\'une ligne ne peut pas dépasser sa quantité facturée.',
            self::PaymentExceedsOutstanding => 'Le règlement dépasse le reste dû de la facture.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour une demande différente.',
            self::IssuerIncomplete => 'Renseignez l\'identité légale du siège (raison sociale, adresse, SIREN, numéro de TVA) avant d\'émettre.',
            self::RecipientIncomplete => 'Un destinataire professionnel doit avoir une adresse et un SIREN ; une partie anonymisée ne peut pas être facturée.',
            self::RecipientEmailMissing => 'Le destinataire n\'a pas d\'adresse e-mail principale.',
            self::PdfUnavailable => 'Le service de génération des PDF ne répond pas : réessayez dans un instant.',
            self::EInvoicingRequired => 'Ce destinataire assujetti doit recevoir une facture électronique : l\'émission en PDF seul est refusée.',
            self::NotDraft => 'Seul un brouillon peut être modifié, émis ou abandonné.',
            self::NotIssued => 'Cette pièce n\'a pas encore été émise.',
            self::NotCreditable => 'Seule une facture émise, non totalement annulée, peut recevoir un avoir.',
            self::NotPayable => 'Seule une facture émise ayant un reste dû peut recevoir un règlement.',
            self::TaxRateUnknown => 'Aucun taux de taxe ne correspond à cette catégorie à la date de la facture.',
            self::TaxRateNotAllowed => 'Ce taux ou cette catégorie de TVA n\'est pas autorisé pour cette nature de ligne ou ce destinataire ; l\'autoliquidation exige un destinataire société avec numéro de TVA.',
            self::LinesInvalid => 'La facture doit porter entre 1 et 100 lignes aux montants valides.',
            self::ReferencesInconsistent => 'Le destinataire doit être partie au bail référencé (ou le mandant d\'un mandat qui couvre un lot du bail) ; sans bail, un mandat ne se facture qu\'à son mandant.',
            self::DueDateInvalid => 'L\'échéance ne peut pas précéder la date d\'émission.',
            self::PaymentInvalid => 'La date du règlement doit être comprise entre l\'émission de la facture et aujourd\'hui.',
            self::FeeComputedByServer => 'Les honoraires de gestion sont facturés par le serveur à partir des encaissements : cette ligne ne se saisit pas.',
        };
    }
}
