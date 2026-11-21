<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

/**
 * Liste fermée (ADR 0033, décision 9) : jamais de conversation, d'IBAN en clair, de secret 2FA ni de pièce d'identité.
 */
enum SupportAccessScope: string
{
    case Settings = 'settings';
    case Team = 'team';
    case Records = 'records';
    case Documents = 'documents';
}
