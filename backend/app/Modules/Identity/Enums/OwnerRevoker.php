<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum OwnerRevoker: string
{
    case Organization = 'organization';
    case Account = 'account';
    case System = 'system';
}
