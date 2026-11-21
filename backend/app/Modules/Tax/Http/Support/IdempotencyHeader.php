<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Support;

use App\Modules\Tax\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    public static function read(Request $requete): string
    {
        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem('L\'en-tête Idempotency-Key est obligatoire (8 à 64 caractères : lettres, chiffres, . _ : -).');
        }

        return $cle;
    }
}
