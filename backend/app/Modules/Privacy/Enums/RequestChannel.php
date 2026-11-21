<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum RequestChannel: string
{
    case Account = 'account';
    case Email = 'email';
    case Letter = 'letter';
}
