<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

final class Fingerprint
{
    /**
     * @param  array<int|string, mixed>  $contenu
     */
    public static function of(array $contenu): string
    {
        return hash('sha256', (string) json_encode($contenu, JSON_THROW_ON_ERROR));
    }
}
