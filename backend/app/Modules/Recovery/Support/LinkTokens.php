<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use Illuminate\Support\Str;

final class LinkTokens
{
    public const int LENGTH = 48;

    public static function generate(): string
    {
        return Str::random(self::LENGTH);
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function wellFormed(string $token): bool
    {
        return preg_match('/^[A-Za-z0-9]{'.self::LENGTH.'}$/D', $token) === 1;
    }
}
