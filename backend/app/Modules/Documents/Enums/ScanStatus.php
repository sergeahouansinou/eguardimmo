<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

/**
 * État d'analyse antivirale d'un fichier (ADR 0033, décision 4). Seul `clean` se lit ; `unverifiable` (analyseur injoignable) reste bloqué
 * et réessayé, jamais livré par défaut ni présenté comme infecté.
 */
enum ScanStatus: string
{
    case Pending = 'pending';
    case Clean = 'clean';
    case Infected = 'infected';
    case Unverifiable = 'unverifiable';

    public function isReadable(): bool
    {
        return $this === self::Clean;
    }
}
