<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum RequestKind: string
{
    case Access = 'access';
    case Rectification = 'rectification';
    case Erasure = 'erasure';
    case Portability = 'portability';
    case Restriction = 'restriction';
    case Objection = 'objection';

    public function requiresReauthentication(): bool
    {
        return $this === self::Erasure || $this->producesExport();
    }

    public function producesExport(): bool
    {
        return $this === self::Access || $this === self::Portability;
    }
}
