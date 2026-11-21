<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case OnlinePaymentNotFound = 'online_payment_not_found';
    case PaymentNothingDue = 'payment_nothing_due';
    case PaymentAccountNotReady = 'payment_account_not_ready';
    case PaymentProviderUnavailable = 'payment_provider_unavailable';
    case PaymentNotCancellable = 'payment_not_cancellable';
    case PaymentMethodUnsupported = 'payment_method_unsupported';
    case WebhookSignatureInvalid = 'webhook_signature_invalid';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case PaymentInstallmentsInProgress = 'payment_installments_in_progress';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), $this === self::PaymentProviderUnavailable ? ['Retry-After' => '60'] : []);
    }

    public function status(): int
    {
        return match ($this) {
            self::OnlinePaymentNotFound => 404,
            self::PaymentProviderUnavailable => 503,
            self::WebhookSignatureInvalid => 401,
            self::PaymentMethodUnsupported => 422,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::OnlinePaymentNotFound => 'Paiement introuvable',
            self::PaymentNothingDue => 'Rien à payer',
            self::PaymentAccountNotReady => 'Paiement en ligne indisponible',
            self::PaymentProviderUnavailable => 'Service de paiement indisponible',
            self::PaymentNotCancellable => 'Paiement non annulable',
            self::PaymentMethodUnsupported => 'Moyen de paiement non pris en charge',
            self::WebhookSignatureInvalid => 'Signature invalide',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
            self::PaymentInstallmentsInProgress => 'Paiement déjà en cours',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::OnlinePaymentNotFound => 'Ce paiement n\'existe pas.',
            self::PaymentNothingDue => 'Aucune des échéances choisies n\'a de reste dû.',
            self::PaymentAccountNotReady => 'Votre agence n\'a pas encore activé le paiement en ligne.',
            self::PaymentProviderUnavailable => 'Le service de paiement ne répond pas : rien n\'a été débité, réessayez plus tard.',
            self::PaymentNotCancellable => 'Ce paiement n\'est plus en attente.',
            self::PaymentMethodUnsupported => 'Ce moyen de paiement n\'est pas encore proposé.',
            self::WebhookSignatureInvalid => 'La signature de la notification est absente ou fausse.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
            self::PaymentInstallmentsInProgress => 'Une de ces échéances fait déjà l\'objet d\'un paiement en cours ou en cours d\'imputation : attendez son résultat ou annulez-le.',
        };
    }
}
