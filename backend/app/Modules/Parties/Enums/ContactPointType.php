<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum ContactPointType: string
{
    case Email = 'email';
    case Phone = 'phone';
}
