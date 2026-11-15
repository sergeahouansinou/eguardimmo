<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum MemberStatus: string
{
    case Invited = 'invited';
    case Active = 'active';
    case Disabled = 'disabled';
}
