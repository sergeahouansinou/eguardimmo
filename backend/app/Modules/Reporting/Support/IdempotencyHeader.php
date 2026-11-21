<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Reporting\Enums\ErrorCode;
use Illuminate\Http\Request;

final class IdempotencyHeader
{
    /**
     * L'en-tête `Idempotency-Key` est obligatoire sur les actions qui écrivent : 422 sinon.
     */
    public static function read(Request $requete): string
    {
        $cle = $requete->header('Idempotency-Key');

        if (! is_string($cle) || preg_match('/^[A-Za-z0-9._:-]{8,120}$/D', $cle) !== 1) {
            throw ErrorCode::IdempotencyKeyRequired->problem();
        }

        return $cle;
    }
}
