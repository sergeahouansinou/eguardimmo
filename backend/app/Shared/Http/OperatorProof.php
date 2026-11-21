<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Http\Request;

/**
 * Nature de la preuve de double authentification vérifiée par le middleware `operator-proof` de la console.
 */
final class OperatorProof
{
    public const ATTRIBUT = 'console.operator_proof';

    public const TOTP = 'totp';

    public const RECOVERY_CODE = 'recovery_code';

    public static function kind(Request $request): string
    {
        $nature = $request->attributes->get(self::ATTRIBUT);

        return $nature === self::RECOVERY_CODE ? self::RECOVERY_CODE : self::TOTP;
    }
}
