<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use Carbon\CarbonImmutable;

/**
 * Dernière preuve par 2FA de la session : `method` vaut `totp` ou `recovery_code`.
 */
final readonly class TwoFactorProofData
{
    public function __construct(public string $method, public CarbonImmutable $at) {}
}
