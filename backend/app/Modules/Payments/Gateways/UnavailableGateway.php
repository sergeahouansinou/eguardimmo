<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Data\CheckoutRequestData;
use App\Modules\Payments\Data\CheckoutSessionData;
use App\Modules\Payments\Data\ConnectedAccountData;
use App\Modules\Payments\Data\GatewayEventData;
use App\Modules\Payments\Data\GatewayPaymentStateData;
use App\Modules\Payments\Enums\ErrorCode;

/**
 * Paiement en ligne désactivé (`PAYMENTS_GATEWAY=none`) : tant que le PSP n'est pas validé, rien ne part vers un fournisseur.
 */
final class UnavailableGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'none';
    }

    public function signatureHeader(): string
    {
        return 'X-Signature';
    }

    public function onboard(string $organizationId): ConnectedAccountData
    {
        throw ErrorCode::PaymentProviderUnavailable->problem();
    }

    public function createCheckout(CheckoutRequestData $request): CheckoutSessionData
    {
        throw ErrorCode::PaymentProviderUnavailable->problem();
    }

    public function cancel(string $providerReference): void {}

    public function fetch(string $providerReference): ?GatewayPaymentStateData
    {
        return null;
    }

    public function readWebhook(string $rawBody, ?string $signature): GatewayEventData
    {
        throw ErrorCode::WebhookSignatureInvalid->problem();
    }
}
