<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Data\CheckoutRequestData;
use App\Modules\Payments\Data\CheckoutSessionData;
use App\Modules\Payments\Data\ConnectedAccountData;
use App\Modules\Payments\Data\GatewayEventData;
use App\Modules\Payments\Data\GatewayPaymentStateData;

/**
 * Contrat du fournisseur de paiement (ADR 0036) : deux implémentations réelles, le PSP retenu et `FakeGateway` (développement, tests).
 * eGuardImmo ne détient jamais les fonds : chaque organisation a son compte connecté chez le PSP.
 */
interface PaymentGateway
{
    public function name(): string;

    /**
     * En-tête HTTP qui porte la signature des notifications du fournisseur.
     */
    public function signatureHeader(): string;

    /**
     * Compte connecté de l'organisation chez le PSP (KYB par le PSP).
     */
    public function onboard(string $organizationId): ConnectedAccountData;

    /**
     * Page de paiement hébergée par le PSP : aucune donnée de carte ne transite chez nous.
     */
    public function createCheckout(CheckoutRequestData $request): CheckoutSessionData;

    public function cancel(string $providerReference): void;

    public function fetch(string $providerReference): ?GatewayPaymentStateData;

    /**
     * Vérifie la signature sur le corps brut (ApiProblem 401 `webhook_signature_invalid` sinon) puis lit l'événement.
     */
    public function readWebhook(string $rawBody, ?string $signature): GatewayEventData;
}
