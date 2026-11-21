<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum SupportAccessStatus: string
{
    case Requested = 'requested';
    case Active = 'active';
    case Refused = 'refused';
    case Revoked = 'revoked';
    case Expired = 'expired';
}
