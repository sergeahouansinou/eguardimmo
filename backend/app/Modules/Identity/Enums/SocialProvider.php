<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum SocialProvider: string
{
    case Google = 'google';
    case Apple = 'apple';
}
