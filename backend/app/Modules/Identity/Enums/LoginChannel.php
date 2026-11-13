<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum LoginChannel: string
{
    case Web = 'web';
    case Mobile = 'mobile';
    case Console = 'console';
}
