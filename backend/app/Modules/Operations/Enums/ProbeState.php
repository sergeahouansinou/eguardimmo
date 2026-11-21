<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

/**
 * Trois états : un délai dépassé ou une erreur non qualifiée est `unknown`, jamais `ok` ni `down` (ADR 0011).
 */
enum ProbeState: string
{
    case Ok = 'ok';
    case Down = 'down';
    case Unknown = 'unknown';

    public function severity(): int
    {
        return match ($this) {
            self::Ok => 0,
            self::Unknown => 1,
            self::Down => 2,
        };
    }
}
