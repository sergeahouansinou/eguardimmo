<?php

declare(strict_types=1);

namespace App\Modules\Tax\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case SummaryNotFound = 'tax_summary_not_found';
    case LandlordOnly = 'tax_landlord_only';
    case AgencyOnly = 'tax_agency_only';
    case IdempotencyKeyRequired = 'tax_idempotency_key_required';
    case YearUnsupported = 'tax_year_unsupported';
    case JurisdictionUnsupported = 'tax_jurisdiction_unsupported';
    case TaxpayerUnsupported = 'tax_taxpayer_unsupported';
    case InterestSourceConflict = 'tax_interest_source_conflict';
    case PeriodNotClosed = 'tax_period_not_closed';
    case OwnerFundsNotReady = 'tax_owner_funds_not_ready';
    case SummaryStaleVersion = 'tax_summary_stale_version';
    case SummaryExists = 'tax_summary_exists';
    case SummaryNotRectifiable = 'tax_summary_not_rectifiable';
    case IdempotencyKeyReused = 'tax_idempotency_key_reused';
    case PdfUnavailable = 'tax_pdf_unavailable';
    case ExportTooLarge = 'tax_export_too_large';
    case MandantNotFound = 'tax_mandant_not_found';
    case NotPublishable = 'tax_summary_not_publishable';
    case BatchTooLarge = 'tax_batch_too_large';
    case BatchTimeExceeded = 'tax_batch_time_exceeded';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->title());
    }

    public function status(): int
    {
        return match ($this) {
            self::SummaryNotFound, self::MandantNotFound => 404,
            self::LandlordOnly, self::AgencyOnly => 403,
            self::IdempotencyKeyRequired, self::ExportTooLarge, self::BatchTooLarge, self::YearUnsupported, self::JurisdictionUnsupported, self::TaxpayerUnsupported => 422,
            self::InterestSourceConflict, self::PeriodNotClosed, self::OwnerFundsNotReady, self::SummaryStaleVersion, self::SummaryExists, self::SummaryNotRectifiable, self::NotPublishable, self::IdempotencyKeyReused => 409,
            self::PdfUnavailable, self::BatchTimeExceeded => 503,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::SummaryNotFound => 'Synthèse fiscale introuvable',
            self::LandlordOnly => 'Réservé aux bailleurs autonomes',
            self::AgencyOnly => 'Réservé aux agences',
            self::IdempotencyKeyRequired => 'En-tête Idempotency-Key obligatoire',
            self::YearUnsupported => 'Année de revenus non prise en charge',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
            self::TaxpayerUnsupported => 'Contribuable non pris en charge',
            self::InterestSourceConflict => 'Double source pour les intérêts d\'emprunt',
            self::PeriodNotClosed => 'Période non terminée ou non close',
            self::OwnerFundsNotReady => 'Fonds des mandants non activés sur cette année',
            self::SummaryStaleVersion => 'La synthèse n\'est plus à jour',
            self::SummaryExists => 'Une synthèse existe déjà pour cette année',
            self::SummaryNotRectifiable => 'Cette synthèse ne se rectifie pas',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée avec un autre contenu',
            self::PdfUnavailable => 'Le PDF est momentanément indisponible',
            self::BatchTooLarge => 'Trop de mandants dans une seule demande',
            self::BatchTimeExceeded => 'Temps de génération épuisé : relancez la demande avec la même clé pour les mandants restants',
            self::ExportTooLarge => 'Export trop volumineux',
            self::MandantNotFound => 'Mandant introuvable',
            self::NotPublishable => 'Ce relevé ne se publie pas',
        };
    }
}
