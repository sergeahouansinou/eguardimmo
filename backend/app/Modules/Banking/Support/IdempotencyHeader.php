<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    public static function read(Request $requete): string
    {
        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match('/^[A-Za-z0-9._:-]{8,120}$/D', $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem();
        }

        return $cle;
    }
}
