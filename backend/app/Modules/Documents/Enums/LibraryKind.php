<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum LibraryKind: string
{
    case Mandate = 'mandate';
    case Lease = 'lease';
    case Diagnostic = 'diagnostic';
    case Photo = 'photo';
    case Other = 'other';

    /**
     * Sujet qu'impose la nature ; nul quand tout sujet, ou aucun, est admis.
     */
    public function requiredSubject(): ?SubjectType
    {
        return match ($this) {
            self::Mandate => SubjectType::Mandate,
            self::Lease => SubjectType::Lease,
            default => null,
        };
    }
}
