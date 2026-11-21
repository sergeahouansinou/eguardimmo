<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case InstallmentNotFound = 'rent_installment_not_found';
    case PaymentNotFound = 'rent_payment_not_found';
    case ReceiptNotFound = 'rent_receipt_not_found';
    case NoticeNotFound = 'rent_notice_not_found';
    case ReceiptVoid = 'rent_receipt_void';
    case LeaseNotBillable = 'rent_lease_not_billable';
    case InstallmentNotIssuable = 'rent_installment_not_issuable';
    case InstallmentHasPayments = 'rent_installment_has_payments';
    case InstallmentNotPaid = 'rent_installment_not_paid';
    case PaymentInvalid = 'rent_payment_invalid';
    case IdempotencyKeyReused = 'rent_idempotency_key_reused';
    case ComponentUnclassified = 'rent_component_unclassified';
    case IssuerUnknown = 'rent_issuer_unknown';
    case PdfUnavailable = 'rent_pdf_unavailable';
    case JurisdictionUnsupported = 'rent_jurisdiction_unsupported';
    case OwnerBackfillAfterClose = 'rent_owner_backfill_after_close';
    case AdjustmentConflict = 'rent_adjustment_conflict';
    case AdjustmentBilled = 'rent_adjustment_billed';
    case PaymentNotCancellable = 'rent_payment_not_cancellable';
    case AdvanceInsufficient = 'rent_advance_insufficient';
    case RefundInvalid = 'rent_refund_invalid';
    case IdempotencyKeyRequired = 'rent_idempotency_key_required';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(?string $detail = null): ApiProblem
    {
        $entetes = $this === self::PdfUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::InstallmentNotFound, self::PaymentNotFound, self::ReceiptNotFound, self::NoticeNotFound => 404,
            self::PaymentInvalid, self::ComponentUnclassified, self::JurisdictionUnsupported, self::RefundInvalid, self::IdempotencyKeyRequired => 422,
            self::PdfUnavailable => 503,
            self::LeaseNotBillable, self::InstallmentNotIssuable, self::InstallmentHasPayments, self::InstallmentNotPaid,
            self::IdempotencyKeyReused, self::IssuerUnknown, self::ReceiptVoid, self::OwnerBackfillAfterClose, self::AdjustmentConflict, self::AdjustmentBilled,
            self::PaymentNotCancellable, self::AdvanceInsufficient => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::InstallmentNotFound => 'Échéance introuvable',
            self::PaymentNotFound => 'Encaissement introuvable',
            self::ReceiptNotFound => 'Quittance introuvable',
            self::NoticeNotFound => 'Avis d\'échéance introuvable',
            self::ReceiptVoid => 'Quittance annulée',
            self::LeaseNotBillable => 'Bail non facturable',
            self::InstallmentNotIssuable => 'Échéance non émissible',
            self::InstallmentHasPayments => 'Échéance déjà encaissée',
            self::InstallmentNotPaid => 'Échéance non soldée',
            self::PaymentInvalid => 'Encaissement invalide',
            self::OwnerBackfillAfterClose => 'Rattrapage impossible après une clôture',
            self::AdjustmentConflict => 'Régularisation déjà programmée',
            self::AdjustmentBilled => 'Régularisation déjà facturée',
            self::PaymentNotCancellable => 'Encaissement non annulable',
            self::AdvanceInsufficient => 'Avance insuffisante',
            self::RefundInvalid => 'Remboursement invalide',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence requise',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::ComponentUnclassified => 'Composante du bail sans sens système',
            self::IssuerUnknown => 'Émetteur introuvable',
            self::PdfUnavailable => 'Service PDF indisponible',
            self::JurisdictionUnsupported => 'Juridiction non prise en charge',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::InstallmentNotFound => 'Cette échéance n\'existe pas dans votre organisation.',
            self::PaymentNotFound => 'Cet encaissement n\'existe pas dans votre organisation.',
            self::ReceiptNotFound => 'Cette quittance n\'existe pas dans votre organisation.',
            self::NoticeNotFound => 'Cet avis d\'échéance n\'existe pas ou n\'a pas encore été émis.',
            self::ReceiptVoid => 'Cette quittance a été annulée : son PDF n\'est plus délivré.',
            self::LeaseNotBillable => 'Seul un bail signé ou terminé peut être facturé ou encaissé.',
            self::InstallmentNotIssuable => 'Seule une échéance à venir peut être émise.',
            self::InstallmentHasPayments => 'Cette échéance a reçu des encaissements : annulez-les avant d\'annuler l\'échéance.',
            self::InstallmentNotPaid => 'Une quittance ne s\'émet que pour une échéance entièrement soldée.',
            self::PaymentInvalid => 'Cet encaissement ne respecte pas les règles du bail : montant, devise ou date.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour un encaissement différent.',
            self::ComponentUnclassified => 'Une composante du bail n\'a pas de sens système (loyer, charges…) : elle ne peut pas être appelée.',
            self::IssuerUnknown => 'L\'organisation émettrice ne peut pas être déterminée pour ce compte.',
            self::PdfUnavailable => 'Le service de génération des PDF ne répond pas : réessayez dans un instant.',
            self::JurisdictionUnsupported => 'La juridiction de ce bail n\'a pas encore de modèle d\'avis ni de quittance.',
            self::AdjustmentConflict => 'Ce décompte est déjà programmé avec un contenu différent.',
            self::AdjustmentBilled => 'Une ligne de ce décompte figure déjà sur une échéance : elle ne peut plus être remplacée.',
            self::PaymentNotCancellable => 'Cet encaissement est un crédit de régularisation ou a déjà été remboursé : il ne s\'annule pas ici.',
            self::AdvanceInsufficient => 'Le montant dépasse l\'avance disponible sur ce bail.',
            self::RefundInvalid => 'Ce remboursement ne respecte pas les règles du bail : montant ou date.',
            self::IdempotencyKeyRequired => 'L\'en-tête Idempotency-Key est obligatoire (8 à 120 caractères).',
            self::OwnerBackfillAfterClose => 'Le rattrapage reprend la date des écritures d\'origine : il n\'est possible qu\'avant la première clôture mensuelle.',
        };
    }
}
