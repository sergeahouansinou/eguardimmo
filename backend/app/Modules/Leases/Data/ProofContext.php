<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

/**
 * Circonstances d'un acte à figer dans le journal de preuve : adresse IP, navigateur, méthode de réauthentification.
 */
final readonly class ProofContext
{
    public function __construct(
        public ?string $ip,
        public ?string $userAgent,
        public ?string $reauthMethod,
    ) {}
}
