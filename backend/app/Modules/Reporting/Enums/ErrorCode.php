<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    private const int RETRY_AFTER_SECONDES = 30;

    case ReportNotFound = 'report_not_found';
    case MandantNotFound = 'report_mandant_not_found';
    case StaleVersion = 'report_stale_version';
    case PeriodOverlap = 'report_period_overlap';
    case PeriodInvalid = 'report_period_invalid';
    case PeriodNotClosed = 'report_period_not_closed';
    case NotEditable = 'report_not_editable';
    case NotPublishable = 'report_not_publishable';
    case IdempotencyKeyRequired = 'report_idempotency_key_required';
    case IdempotencyKeyReused = 'report_idempotency_key_reused';
    case IssuerIncomplete = 'report_issuer_incomplete';
    case PdfUnavailable = 'report_pdf_unavailable';
    case NotGenerated = 'report_not_generated';
    case StatementTooLong = 'statement_too_long';
    case ExportTooLarge = 'export_too_large';
    case AgencyOnly = 'reporting_agency_only';
    case JurisdictionUnsupported = 'reporting_jurisdiction_unsupported';
    case OwnerReportNotFound = 'owner_report_not_found';
    case LandlordOnly = 'reporting_landlord_only';
    case ForecastAssumptionsStale = 'forecast_assumptions_stale';
    case ProfitabilityPeriodInvalid = 'profitability_period_invalid';
    case FinanceTooLarge = 'finance_too_large';
    case ExportTypeUnknown = 'export_type_unknown';
    case OwnerMandantNotFound = 'owner_mandant_not_found';
    case OwnerAgencyRequired = 'owner_agency_required';

    public function problem(?string $detail = null): ApiProblem
    {
        $entetes = $this === self::PdfUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::ReportNotFound, self::MandantNotFound, self::OwnerReportNotFound, self::ExportTypeUnknown, self::OwnerMandantNotFound => 404,
            self::AgencyOnly, self::LandlordOnly => 403,
            self::PeriodInvalid, self::IdempotencyKeyRequired, self::IssuerIncomplete, self::StatementTooLong, self::ExportTooLarge, self::JurisdictionUnsupported, self::ProfitabilityPeriodInvalid, self::FinanceTooLarge, self::OwnerAgencyRequired => 422,
            self::PdfUnavailable => 503,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::ReportNotFound, self::OwnerReportNotFound => 'Compte rendu introuvable',
            self::MandantNotFound => 'Mandant introuvable',
            self::StaleVersion => 'Compte rendu modifié entre-temps',
            self::PeriodOverlap => 'Période déjà couverte',
            self::PeriodInvalid => 'Période invalide',
            self::PeriodNotClosed => 'Période non close',
            self::NotEditable => 'Compte rendu non modifiable',
            self::NotPublishable => 'Compte rendu non publiable',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence requise',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::IssuerIncomplete => 'Identité de l\'agence incomplète',
            self::PdfUnavailable => 'Service PDF indisponible',
            self::NotGenerated => 'Compte rendu non généré',
            self::StatementTooLong => 'Relevé trop long',
            self::ExportTooLarge => 'Export trop volumineux',
            self::AgencyOnly => 'Fonction réservée aux agences',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::LandlordOnly => 'Fonction réservée aux bailleurs autonomes',
            self::ForecastAssumptionsStale => 'Hypothèses modifiées entre-temps',
            self::ProfitabilityPeriodInvalid => 'Année de rentabilité invalide',
            self::FinanceTooLarge => 'Vue trop volumineuse',
            self::ExportTypeUnknown => 'Export inconnu',
            self::OwnerMandantNotFound => 'Mandant introuvable',
            self::OwnerAgencyRequired => 'Agence à préciser',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::ReportNotFound => 'Ce compte rendu n\'existe pas dans votre organisation.',
            self::OwnerReportNotFound => 'Ce compte rendu n\'existe pas dans votre espace ou n\'est pas publié.',
            self::MandantNotFound => 'Ce mandant n\'existe pas dans votre organisation.',
            self::StaleVersion => 'Ce compte rendu a été modifié depuis votre lecture : rechargez-le.',
            self::PeriodOverlap => 'Un compte rendu vivant ou publié couvre déjà tout ou partie de cette période pour ce mandant.',
            self::PeriodInvalid => 'La période doit être terminée, couvrir un mandat et ne pas dépasser 12 mois.',
            self::PeriodNotClosed => 'Un compte rendu ne se publie que lorsque tous les mois de sa période sont clos en comptabilité.',
            self::NotEditable => 'L\'état de ce compte rendu ne permet pas cette action.',
            self::NotPublishable => 'Ce compte rendu ne peut pas être publié dans son état actuel.',
            self::IdempotencyKeyRequired => 'L\'en-tête Idempotency-Key est obligatoire pour cette action.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour une demande différente.',
            self::IssuerIncomplete => 'Renseignez l\'identité légale de l\'agence (raison sociale, adresse, SIREN) avant de générer un compte rendu.',
            self::PdfUnavailable => 'Le service de génération des PDF ne répond pas : réessayez dans un instant.',
            self::NotGenerated => 'Ce compte rendu n\'a pas encore de chiffres : générez-le d\'abord.',
            self::ExportTooLarge => 'L\'export dépasse le nombre de lignes autorisé : réduisez la période.',
            self::StatementTooLong => 'Le relevé dépasse le nombre de lignes autorisé : réduisez la période.',
            self::AgencyOnly => 'Les comptes rendus de gestion sont réservés aux organisations de type agence.',
            self::JurisdictionUnsupported => 'La juridiction du siège n\'a pas encore de règles pour les comptes rendus de gestion.',
            self::LandlordOnly => 'La rentabilité, le prévisionnel et leurs exports sont réservés aux organisations de type particulier.',
            self::ForecastAssumptionsStale => 'Les hypothèses ont été modifiées depuis votre lecture : rechargez-les.',
            self::ProfitabilityPeriodInvalid => 'L\'année doit être comprise entre 2000 et l\'année en cours.',
            self::ExportTypeUnknown => 'Ce type d\'export n\'existe pas.',
            self::OwnerMandantNotFound => 'Aucun mandant lisible n\'est rattaché à votre compte.',
            self::OwnerAgencyRequired => 'Plusieurs mandants sont rattachés à votre compte : précisez l\'agence avec le paramètre agency.',
            self::FinanceTooLarge => 'Cette vue dépasse le nombre de lots autorisé : réduisez la période ou contactez le support.',
        };
    }
}
