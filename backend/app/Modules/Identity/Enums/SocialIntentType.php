<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum SocialIntentType: string
{
    case Login = 'login';
    case Register = 'register';
    case Link = 'link';
}
