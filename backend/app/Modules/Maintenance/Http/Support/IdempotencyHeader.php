<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Support;

use App\Modules\Maintenance\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    private const string MOTIF = '/^[A-Za-z0-9._:-]{8,64}$/D';

    public static function read(Request $requete): string
    {
        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match(self::MOTIF, $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem('L\'en-tête Idempotency-Key est obligatoire (8 à 64 caractères : lettres, chiffres, . _ : -).');
        }

        return $cle;
    }

    /**
     * Clé facultative : absente, l'écriture reste non rejouable ; présente mais mal formée, elle est refusée plutôt qu'ignorée.
     */
    public static function readOptional(Request $requete): ?string
    {
        if (! $requete->headers->has('Idempotency-Key')) {
            return null;
        }

        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match(self::MOTIF, $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem('L\'en-tête Idempotency-Key doit comporter 8 à 64 caractères : lettres, chiffres, . _ : -.');
        }

        return $cle;
    }
}
