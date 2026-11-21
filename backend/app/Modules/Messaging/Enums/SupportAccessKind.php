<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum SupportAccessKind: string
{
    case Consent = 'consent';
    case Emergency = 'emergency';
}
