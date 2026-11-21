<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Data\CheckoutRequestData;
use App\Modules\Payments\Data\CheckoutSessionData;
use App\Modules\Payments\Data\ConnectedAccountData;
use App\Modules\Payments\Data\GatewayEventData;
use App\Modules\Payments\Data\GatewayPaymentStateData;
use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * PSP simulé : aucun appel réseau, aucune clé réelle. Le webhook est signé en HMAC-SHA256 hexadécimal du corps brut.
 */
final class FakeGateway implements PaymentGateway
{
    public const SIGNATURE_HEADER = 'X-Fake-Signature';

    private const TYPES = [
        'payment.processing' => OnlinePaymentStatus::Processing,
        'payment.succeeded' => OnlinePaymentStatus::Succeeded,
        'payment.failed' => OnlinePaymentStatus::Failed,
        'payment.cancelled' => OnlinePaymentStatus::Cancelled,
        'payment.expired' => OnlinePaymentStatus::Expired,
    ];

    public function name(): string
    {
        return 'fake';
    }

    public function signatureHeader(): string
    {
        return self::SIGNATURE_HEADER;
    }

    public function onboard(string $organizationId): ConnectedAccountData
    {
        return new ConnectedAccountData('acct_fake_'.substr(hash('sha256', $organizationId), 0, 16), true, null);
    }

    public function createCheckout(CheckoutRequestData $request): CheckoutSessionData
    {
        $reference = 'fake_'.Str::lower((string) Str::ulid());
        Cache::put(self::stateKey($reference), ['status' => OnlinePaymentStatus::Pending->value, 'amount' => $request->amount, 'currency' => $request->currency], now()->addDays(3));

        return new CheckoutSessionData($reference, 'https://pay.fake.invalid/checkout/'.$reference);
    }

    public function cancel(string $providerReference): void
    {
        Cache::forget(self::stateKey($providerReference));
    }

    public function fetch(string $providerReference): ?GatewayPaymentStateData
    {
        $etat = Cache::get(self::stateKey($providerReference));

        return is_array($etat) ? new GatewayPaymentStateData(OnlinePaymentStatus::from((string) $etat['status']), (int) $etat['amount'], is_string($etat['currency'] ?? null) ? $etat['currency'] : null) : null;
    }

    public function readWebhook(string $rawBody, ?string $signature): GatewayEventData
    {
        $secret = (string) config('payments.providers.fake.webhook_secret');

        if ($secret === '' || $signature === null || ! hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature)) {
            throw ErrorCode::WebhookSignatureInvalid->problem();
        }

        $charge = json_decode($rawBody, true);

        if (! is_array($charge) || ! is_string($charge['id'] ?? null) || ! is_string($charge['type'] ?? null) || strlen($charge['id']) > 120) {
            throw ErrorCode::WebhookSignatureInvalid->problem('Corps de notification illisible.');
        }

        return new GatewayEventData(
            $charge['id'],
            substr($charge['type'], 0, 60),
            is_string($charge['reference'] ?? null) ? $charge['reference'] : null,
            self::TYPES[$charge['type']] ?? null,
            is_int($charge['amount'] ?? null) ? $charge['amount'] : null,
            is_string($charge['currency'] ?? null) ? strtoupper($charge['currency']) : null,
            is_string($charge['failure_code'] ?? null) ? substr($charge['failure_code'], 0, 60) : null,
        );
    }

    /**
     * Simule côté PSP l'issue d'un paiement, pour `fetch()` (rapprochement) et les tests.
     */
    public static function settle(string $providerReference, OnlinePaymentStatus $status, int $amount, string $currency = 'EUR'): void
    {
        Cache::put(self::stateKey($providerReference), ['status' => $status->value, 'amount' => $amount, 'currency' => $currency], now()->addDays(3));
    }

    private static function stateKey(string $reference): string
    {
        return 'payments:fake:'.$reference;
    }
}
