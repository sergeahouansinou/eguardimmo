<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Support;

use App\Modules\Recovery\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    /**
     * Clé facultative : absente, l'écriture reste non rejouable ; présente mais mal formée, elle est refusée plutôt qu'ignorée.
     */
    public static function readOptional(Request $requete): ?string
    {
        if (! $requete->headers->has('Idempotency-Key')) {
            return null;
        }

        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match('/^[A-Za-z0-9._:-]{8,64}$/D', $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem();
        }

        return $cle;
    }
}
