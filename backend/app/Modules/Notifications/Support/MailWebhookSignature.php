<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

/**
 * Signature d'un webhook de fournisseur d'e-mail : HMAC-SHA256 du corps brut, comparé en temps constant. Sans secret configuré,
 * toute requête est refusée : jamais de webhook ouvert par défaut.
 */
final class MailWebhookSignature
{
    public function valid(string $fournisseur, string $corps, ?string $signature): bool
    {
        $secret = config('notifications.campaigns.webhook_secrets.'.$fournisseur);

        if (! is_string($secret) || $secret === '' || $signature === null || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $corps, $secret), strtolower(trim($signature)));
    }
}
