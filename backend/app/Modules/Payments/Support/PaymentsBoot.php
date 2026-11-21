<?php

declare(strict_types=1);

namespace App\Modules\Payments\Support;

use InvalidArgumentException;
use RuntimeException;

/**
 * Garde de démarrage du module : une valeur inconnue lève une exception, jamais un repli ; en production, ni passerelle simulée, ni secret
 * de webhook simulé, ni page de retour hors HTTPS.
 */
final class PaymentsBoot
{
    public const array PASSERELLES = ['none', 'fake', 'stripe'];

    public static function assertBootable(mixed $passerelle, bool $production, mixed $secretSimule, mixed $urlRetour): void
    {
        if (! is_string($passerelle) || ! in_array($passerelle, self::PASSERELLES, true)) {
            throw new InvalidArgumentException('PAYMENTS_GATEWAY doit valoir none, fake ou stripe.');
        }

        if (! $production) {
            return;
        }

        if ($passerelle === 'fake') {
            throw new RuntimeException('En production, PAYMENTS_GATEWAY ne peut pas valoir fake : le PSP simulé n\'encaisse rien.');
        }

        if (is_string($secretSimule) && $secretSimule !== '') {
            throw new RuntimeException('En production, PAYMENTS_FAKE_WEBHOOK_SECRET doit rester vide.');
        }

        if (! is_string($urlRetour) || ! str_starts_with($urlRetour, 'https://')) {
            throw new RuntimeException('En production, PAYMENTS_RETURN_URL doit commencer par https://.');
        }
    }
}
