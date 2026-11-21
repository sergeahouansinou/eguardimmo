<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum OwnerAccessStatus: string
{
    case Active = 'active';
    case Revoked = 'revoked';
}
