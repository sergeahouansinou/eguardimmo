<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Support;

use App\Modules\Bookings\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    public static function read(Request $requete): string
    {
        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem();
        }

        return $cle;
    }
}
